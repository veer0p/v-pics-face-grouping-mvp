from __future__ import annotations

import argparse
import os
import socket
import threading
import time
import traceback
from pathlib import Path
from typing import List

from pipeline import ImageInput, PipelineConfig, run_pipeline
from supabase_client import SupabaseWorkerClient


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


def must_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def build_worker_id() -> str:
    configured = os.getenv("WORKER_ID")
    if configured:
        return configured
    return f"worker-{socket.gethostname()}"


def heartbeat_loop(
    client: SupabaseWorkerClient,
    stop_event: threading.Event,
    job_id: str,
    worker_id: str,
    heartbeat_seconds: int,
    lease_seconds: int,
) -> None:
    while not stop_event.wait(heartbeat_seconds):
        try:
            client.heartbeat_job(job_id=job_id, worker_id=worker_id, lease_seconds=lease_seconds)
        except Exception:
            # Main loop will fail this job if processing stops.
            traceback.print_exc()
            break


def process_job(
    client: SupabaseWorkerClient,
    worker_id: str,
    lease_seconds: int,
    heartbeat_seconds: int,
) -> bool:
    claimed = client.claim_next_job(worker_id=worker_id, lease_seconds=lease_seconds)
    if not claimed:
        return False

    job_payload = claimed.get("job") or {}
    image_payloads = claimed.get("images") or []
    job_id = str(job_payload.get("id"))
    config = PipelineConfig.from_dict(job_payload.get("config") or {})

    images: List[ImageInput] = []
    for item in image_payloads:
        images.append(
            ImageInput(
                id=str(item["id"]),
                object_path=str(item["object_path"]),
                original_filename=str(item.get("original_filename") or ""),
                mime_type=str(item.get("mime_type") or "application/octet-stream"),
                size_bytes=int(item.get("size_bytes") or 0),
            )
        )

    print(f"[worker] claimed job={job_id} images={len(images)}")
    stop_heartbeat = threading.Event()
    heartbeat_thread = threading.Thread(
        target=heartbeat_loop,
        args=(client, stop_heartbeat, job_id, worker_id, heartbeat_seconds, lease_seconds),
        daemon=True,
    )
    heartbeat_thread.start()

    try:
        run_result = run_pipeline(
            job_id=job_id,
            images=images,
            config=config,
            download_image=client.download_original,
            upload_crop=client.upload_crop,
        )
        cluster_map = client.upsert_clusters(job_id=job_id, clusters=run_result.clusters)
        client.insert_faces(job_id=job_id, faces=run_result.faces, cluster_id_by_label=cluster_map)
        client.complete_job(job_id=job_id, stats=run_result.stats)
        print(f"[worker] completed job={job_id} stats={run_result.stats}")
    except Exception as exc:
        traceback.print_exc()
        client.fail_job(job_id=job_id, error_message=str(exc))
        print(f"[worker] failed job={job_id}: {exc}")
    finally:
        stop_heartbeat.set()
        heartbeat_thread.join(timeout=2)

    return True


def main() -> None:
    root_dir = Path(__file__).resolve().parents[1]
    load_env_file(root_dir / ".env")

    parser = argparse.ArgumentParser(description="Background worker for face grouping jobs.")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process at most one job and exit.",
    )
    args = parser.parse_args()

    project_url = os.getenv("SUPABASE_URL") or must_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = must_env("SUPABASE_SERVICE_ROLE_KEY")
    worker_id = build_worker_id()
    poll_seconds = int(os.getenv("WORKER_POLL_SECONDS", "5"))
    lease_seconds = int(os.getenv("WORKER_LEASE_SECONDS", "300"))
    heartbeat_seconds = int(os.getenv("WORKER_HEARTBEAT_SECONDS", "30"))

    client = SupabaseWorkerClient(project_url=project_url, service_role_key=service_role_key)
    print(
        f"[worker] started id={worker_id} poll={poll_seconds}s lease={lease_seconds}s "
        f"heartbeat={heartbeat_seconds}s"
    )

    while True:
        processed = process_job(
            client=client,
            worker_id=worker_id,
            lease_seconds=lease_seconds,
            heartbeat_seconds=heartbeat_seconds,
        )
        if args.once:
            break
        if not processed:
            time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
