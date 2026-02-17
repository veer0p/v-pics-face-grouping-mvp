#!/usr/bin/env python
"""
Face clustering prototype:
1) Detect faces
2) Extract embeddings
3) Cluster same identities across photos
4) Optionally evaluate clustering quality
"""

from __future__ import annotations

import argparse
import csv
import math
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterable, List, Sequence, Tuple

import cv2
import numpy as np
from sklearn.cluster import DBSCAN
from tqdm import tqdm

if TYPE_CHECKING:  # pragma: no cover
    from insightface.app import FaceAnalysis


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@dataclass
class FaceRecord:
    face_id: int
    image_path: Path
    parent_label: str
    bbox: Tuple[int, int, int, int]
    det_score: float
    embedding: np.ndarray


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Cluster the same person across photos using face embeddings."
    )
    parser.add_argument("--input", type=Path, required=True, help="Input folder of images.")
    parser.add_argument("--output", type=Path, default=Path("output"), help="Output folder.")

    parser.add_argument(
        "--eps",
        type=float,
        default=0.35,
        help="DBSCAN cosine distance threshold (smaller = stricter).",
    )
    parser.add_argument("--min-samples", type=int, default=2, help="DBSCAN min_samples.")
    parser.add_argument(
        "--min-det-score",
        type=float,
        default=0.5,
        help="Minimum face detection confidence.",
    )
    parser.add_argument(
        "--det-size",
        type=int,
        default=640,
        help="Face detector input size (square).",
    )
    parser.add_argument(
        "--providers",
        type=str,
        default="CPUExecutionProvider",
        help="Comma-separated onnxruntime providers.",
    )

    parser.add_argument(
        "--assume-single-face",
        action="store_true",
        help="Keep only the largest detected face per image.",
    )
    parser.add_argument(
        "--save-crops",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Save per-face crops grouped by cluster.",
    )
    parser.add_argument(
        "--reassign-noise",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Assign DBSCAN noise faces to nearest centroid when similarity is high.",
    )
    parser.add_argument(
        "--noise-sim-threshold",
        type=float,
        default=0.50,
        help="Cosine similarity needed to reassign noise to nearest cluster.",
    )

    parser.add_argument(
        "--evaluate",
        action="store_true",
        help="Evaluate clustering using parent folder names as identity labels.",
    )
    parser.add_argument(
        "--tune-eps",
        action="store_true",
        help="Search eps range and select best eps by pairwise F1 (requires --evaluate).",
    )
    parser.add_argument("--eps-min", type=float, default=0.20, help="Min eps for tuning.")
    parser.add_argument("--eps-max", type=float, default=0.50, help="Max eps for tuning.")
    parser.add_argument("--eps-step", type=float, default=0.02, help="Step size for tuning.")
    return parser.parse_args()


def list_images(input_dir: Path) -> List[Path]:
    return sorted(
        [
            path
            for path in input_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        ]
    )


def read_image(path: Path) -> np.ndarray | None:
    data = np.fromfile(str(path), dtype=np.uint8)
    if data.size == 0:
        return None
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


def save_image(path: Path, image: np.ndarray) -> bool:
    ext = path.suffix if path.suffix else ".jpg"
    ok, buffer = cv2.imencode(ext, image)
    if not ok:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    buffer.tofile(str(path))
    return True


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    denom = np.linalg.norm(vec) + 1e-12
    return vec / denom


def bbox_area(bbox: Sequence[int]) -> float:
    x1, y1, x2, y2 = bbox
    return max(0, x2 - x1) * max(0, y2 - y1)


def crop_with_margin(image: np.ndarray, bbox: Tuple[int, int, int, int], margin: float = 0.25) -> np.ndarray:
    h, w = image.shape[:2]
    x1, y1, x2, y2 = bbox
    bw = x2 - x1
    bh = y2 - y1
    mx = int(bw * margin)
    my = int(bh * margin)
    cx1 = max(0, x1 - mx)
    cy1 = max(0, y1 - my)
    cx2 = min(w, x2 + mx)
    cy2 = min(h, y2 + my)
    return image[cy1:cy2, cx1:cx2]


def prepare_legacy_model_pack(root_dir: Path, model_name: str = "buffalo_l") -> str:
    source_dir = root_dir / model_name
    if not source_dir.exists():
        return model_name

    required = ["det_10g.onnx", "w600k_r50.onnx"]
    if not all((source_dir / fname).exists() for fname in required):
        return model_name

    legacy_name = f"{model_name}_legacy"
    legacy_dir = root_dir / legacy_name
    legacy_dir.mkdir(parents=True, exist_ok=True)
    for fname in required:
        src = source_dir / fname
        dst = legacy_dir / fname
        if not dst.exists():
            shutil.copy2(src, dst)
    return legacy_name


def make_face_app(providers: List[str], det_size: int) -> Any:
    try:
        from insightface.app import FaceAnalysis
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "Missing dependency: insightface. Install with `pip install -r requirements.txt`."
        ) from exc

    # InsightFace API differs by version:
    # - newer: FaceAnalysis(..., providers=[...])
    # - older: FaceAnalysis(name, root="...")
    try:
        app = FaceAnalysis(name="buffalo_l", providers=providers)
    except TypeError:
        root_dir = Path.home() / ".insightface" / "models"
        legacy_name = prepare_legacy_model_pack(root_dir, model_name="buffalo_l")
        app = FaceAnalysis(name=legacy_name, root=str(root_dir))
    app.prepare(ctx_id=0, det_size=(det_size, det_size))
    return app


def extract_records(
    app: Any,
    image_paths: Iterable[Path],
    min_det_score: float,
    assume_single_face: bool,
) -> List[FaceRecord]:
    records: List[FaceRecord] = []
    next_face_id = 0

    for image_path in tqdm(list(image_paths), desc="Extracting embeddings"):
        image = read_image(image_path)
        if image is None:
            continue

        faces = app.get(image)
        if not faces:
            continue

        filtered = [f for f in faces if float(f.det_score) >= min_det_score]
        if not filtered:
            continue

        if assume_single_face:
            filtered = [max(filtered, key=lambda f: bbox_area([int(v) for v in f.bbox]))]

        for face in filtered:
            bbox = tuple(int(v) for v in face.bbox[:4])
            emb = l2_normalize(np.asarray(face.embedding, dtype=np.float32))
            records.append(
                FaceRecord(
                    face_id=next_face_id,
                    image_path=image_path,
                    parent_label=image_path.parent.name,
                    bbox=bbox,
                    det_score=float(face.det_score),
                    embedding=emb,
                )
            )
            next_face_id += 1

    return records


def cluster_embeddings(
    embeddings: np.ndarray,
    eps: float,
    min_samples: int,
) -> np.ndarray:
    model = DBSCAN(eps=eps, min_samples=min_samples, metric="cosine", n_jobs=-1)
    return model.fit_predict(embeddings)


def reassign_noise_to_centroids(
    labels: np.ndarray,
    embeddings: np.ndarray,
    similarity_threshold: float,
) -> np.ndarray:
    output = labels.copy()
    cluster_ids = sorted(c for c in set(labels.tolist()) if c >= 0)
    if not cluster_ids:
        return output

    centroids = {}
    for cid in cluster_ids:
        idx = np.where(labels == cid)[0]
        centroid = embeddings[idx].mean(axis=0)
        centroid = l2_normalize(centroid)
        centroids[cid] = centroid

    noise_idx = np.where(labels == -1)[0]
    for idx in noise_idx:
        emb = embeddings[idx]
        best_cid = -1
        best_sim = -1.0
        for cid, centroid in centroids.items():
            sim = float(np.dot(emb, centroid))
            if sim > best_sim:
                best_sim = sim
                best_cid = cid
        if best_sim >= similarity_threshold:
            output[idx] = best_cid
    return output


def labels_with_unique_noise(labels: Sequence[int]) -> List[str]:
    unique_labels: List[str] = []
    noise_counter = 0
    for label in labels:
        if int(label) == -1:
            unique_labels.append(f"noise_{noise_counter}")
            noise_counter += 1
        else:
            unique_labels.append(f"cluster_{int(label)}")
    return unique_labels


def pairwise_precision_recall_f1(
    y_true: Sequence[str],
    y_pred: Sequence[int],
) -> Tuple[float, float, float]:
    pred = labels_with_unique_noise(y_pred)
    n = len(y_true)
    if n < 2:
        return 0.0, 0.0, 0.0

    tp = 0
    fp = 0
    fn = 0
    for i in range(n):
        for j in range(i + 1, n):
            same_true = y_true[i] == y_true[j]
            same_pred = pred[i] == pred[j]
            if same_true and same_pred:
                tp += 1
            elif not same_true and same_pred:
                fp += 1
            elif same_true and not same_pred:
                fn += 1

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


def tune_eps(
    embeddings: np.ndarray,
    y_true: Sequence[str],
    min_samples: int,
    eps_min: float,
    eps_max: float,
    eps_step: float,
    reassign_noise: bool,
    noise_sim_threshold: float,
) -> Tuple[float, float, float, float]:
    best_eps = eps_min
    best_p = 0.0
    best_r = 0.0
    best_f1 = -1.0

    steps = int(math.floor((eps_max - eps_min) / eps_step)) + 1
    candidates = [round(eps_min + i * eps_step, 6) for i in range(steps)]

    for eps in candidates:
        labels = cluster_embeddings(embeddings, eps=eps, min_samples=min_samples)
        if reassign_noise:
            labels = reassign_noise_to_centroids(labels, embeddings, noise_sim_threshold)
        p, r, f1 = pairwise_precision_recall_f1(y_true, labels)
        print(f"[tune] eps={eps:.3f} precision={p:.4f} recall={r:.4f} f1={f1:.4f}")
        if f1 > best_f1:
            best_eps = eps
            best_p = p
            best_r = r
            best_f1 = f1

    return best_eps, best_p, best_r, best_f1


def save_cluster_outputs(
    output_dir: Path,
    records: Sequence[FaceRecord],
    labels: np.ndarray,
    save_crops: bool,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    csv_path = output_dir / "clusters.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "face_id",
                "cluster_id",
                "image_path",
                "parent_label",
                "bbox_x1",
                "bbox_y1",
                "bbox_x2",
                "bbox_y2",
                "det_score",
            ]
        )
        for record, cluster_id in zip(records, labels.tolist()):
            x1, y1, x2, y2 = record.bbox
            writer.writerow(
                [
                    record.face_id,
                    cluster_id,
                    str(record.image_path),
                    record.parent_label,
                    x1,
                    y1,
                    x2,
                    y2,
                    f"{record.det_score:.6f}",
                ]
            )

    if not save_crops:
        return

    for record, cluster_id in tqdm(
        list(zip(records, labels.tolist())), desc="Saving clustered face crops"
    ):
        image = read_image(record.image_path)
        if image is None:
            continue
        crop = crop_with_margin(image, record.bbox, margin=0.25)
        if crop.size == 0:
            continue

        cluster_name = "cluster_noise" if cluster_id == -1 else f"cluster_{int(cluster_id):04d}"
        base_name = record.image_path.stem
        out_file = (
            output_dir
            / "clusters"
            / cluster_name
            / f"face_{record.face_id:06d}_{base_name}.jpg"
        )
        save_image(out_file, crop)


def print_summary(records: Sequence[FaceRecord], labels: np.ndarray) -> None:
    total_faces = len(records)
    total_images = len({r.image_path for r in records})
    cluster_ids = [int(v) for v in labels.tolist() if int(v) >= 0]
    num_clusters = len(set(cluster_ids))
    noise_count = int(np.sum(labels == -1))

    print("\n=== Summary ===")
    print(f"Detected faces: {total_faces}")
    print(f"Images with at least one face: {total_images}")
    print(f"Identity clusters (excluding noise): {num_clusters}")
    print(f"Unclustered/noise faces: {noise_count}")


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise SystemExit(f"Input folder does not exist: {args.input}")
    if args.evaluate and not args.assume_single_face:
        print(
            "Warning: --evaluate assumes each extracted face matches parent folder label. "
            "Use --assume-single-face for reliable metrics."
        )

    image_paths = list_images(args.input)
    if not image_paths:
        raise SystemExit(f"No images found under: {args.input}")
    print(f"Found {len(image_paths)} images.")

    providers = [p.strip() for p in args.providers.split(",") if p.strip()]
    app = make_face_app(providers=providers, det_size=args.det_size)

    records = extract_records(
        app=app,
        image_paths=image_paths,
        min_det_score=args.min_det_score,
        assume_single_face=args.assume_single_face,
    )
    if not records:
        raise SystemExit("No usable faces were detected.")

    embeddings = np.vstack([r.embedding for r in records]).astype(np.float32)
    y_true = [r.parent_label for r in records]

    chosen_eps = args.eps
    if args.tune_eps:
        if not args.evaluate:
            raise SystemExit("--tune-eps requires --evaluate.")
        best_eps, best_p, best_r, best_f1 = tune_eps(
            embeddings=embeddings,
            y_true=y_true,
            min_samples=args.min_samples,
            eps_min=args.eps_min,
            eps_max=args.eps_max,
            eps_step=args.eps_step,
            reassign_noise=args.reassign_noise,
            noise_sim_threshold=args.noise_sim_threshold,
        )
        chosen_eps = best_eps
        print(
            f"\nBest eps={best_eps:.3f} with precision={best_p:.4f}, "
            f"recall={best_r:.4f}, f1={best_f1:.4f}"
        )

    labels = cluster_embeddings(embeddings, eps=chosen_eps, min_samples=args.min_samples)
    if args.reassign_noise:
        labels = reassign_noise_to_centroids(labels, embeddings, args.noise_sim_threshold)

    print_summary(records, labels)
    if args.evaluate:
        p, r, f1 = pairwise_precision_recall_f1(y_true, labels)
        print(
            f"Pairwise precision={p:.4f} recall={r:.4f} f1={f1:.4f} "
            f"(ground truth = parent folder name)"
        )

    save_cluster_outputs(args.output, records, labels, save_crops=args.save_crops)
    print(f"Outputs written to: {args.output.resolve()}")


if __name__ == "__main__":
    main()
