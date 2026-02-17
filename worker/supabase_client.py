from __future__ import annotations

from typing import Dict, Iterable, List

import numpy as np
from supabase import Client, create_client

from pipeline import ClusterResult, FaceResult


def _to_vector_literal(embedding: np.ndarray) -> str:
    values = ",".join(f"{float(v):.8f}" for v in embedding.tolist())
    return f"[{values}]"


class SupabaseWorkerClient:
    def __init__(self, project_url: str, service_role_key: str):
        self.client: Client = create_client(project_url, service_role_key)

    def claim_next_job(self, worker_id: str, lease_seconds: int) -> Optional[dict]:
        response = self.client.rpc(
            "rpc_claim_next_job",
            {"p_worker_id": worker_id, "p_lease_seconds": lease_seconds},
        ).execute()
        return response.data

    def heartbeat_job(self, job_id: str, worker_id: str, lease_seconds: int) -> None:
        self.client.rpc(
            "rpc_heartbeat_job",
            {
                "p_job_id": job_id,
                "p_worker_id": worker_id,
                "p_lease_seconds": lease_seconds,
            },
        ).execute()

    def complete_job(self, job_id: str, stats: dict) -> None:
        self.client.rpc(
            "rpc_complete_job",
            {"p_job_id": job_id, "p_stats": stats},
        ).execute()

    def fail_job(self, job_id: str, error_message: str) -> None:
        self.client.rpc(
            "rpc_fail_job",
            {"p_job_id": job_id, "p_error": error_message},
        ).execute()

    def download_original(self, object_path: str) -> bytes:
        return self.client.storage.from_("photo-originals").download(object_path)

    def upload_crop(self, object_path: str, payload: bytes) -> None:
        self.client.storage.from_("face-crops").upload(
            object_path,
            payload,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )

    def upsert_clusters(self, job_id: str, clusters: Iterable[ClusterResult]) -> Dict[int, str]:
        rows = [
            {
                "job_id": job_id,
                "cluster_label": cluster.cluster_label,
                "face_count": cluster.face_count,
                "preview_crop_path": cluster.preview_crop_path,
            }
            for cluster in clusters
        ]
        if rows:
            self.client.table("person_clusters").upsert(
                rows,
                on_conflict="job_id,cluster_label",
            ).execute()

        response = (
            self.client.table("person_clusters")
            .select("id,cluster_label")
            .eq("job_id", job_id)
            .execute()
        )
        mapping: Dict[int, str] = {}
        for row in response.data or []:
            mapping[int(row["cluster_label"])] = row["id"]
        return mapping

    def insert_faces(
        self,
        job_id: str,
        faces: List[FaceResult],
        cluster_id_by_label: Dict[int, str],
        chunk_size: int = 200,
    ) -> None:
        if not faces:
            return

        rows = []
        for face in faces:
            cluster_id = cluster_id_by_label.get(face.cluster_label)
            rows.append(
                {
                    "job_id": job_id,
                    "image_id": face.image_id,
                    "cluster_id": cluster_id,
                    "face_index": face.face_index,
                    "det_score": face.det_score,
                    "bbox": {
                        "x1": int(face.bbox[0]),
                        "y1": int(face.bbox[1]),
                        "x2": int(face.bbox[2]),
                        "y2": int(face.bbox[3]),
                    },
                    "embedding": _to_vector_literal(face.embedding),
                    "crop_path": face.crop_path,
                }
            )

        for start in range(0, len(rows), chunk_size):
            self.client.table("detected_faces").insert(rows[start : start + chunk_size]).execute()
