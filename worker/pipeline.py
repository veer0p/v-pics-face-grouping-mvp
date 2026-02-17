from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Tuple

import cv2
import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from face_cluster import (  # noqa: E402
    cluster_embeddings,
    crop_with_margin,
    l2_normalize,
    make_face_app,
    reassign_noise_to_centroids,
)


@dataclass
class ImageInput:
    id: str
    object_path: str
    original_filename: str
    mime_type: str
    size_bytes: int


@dataclass
class PipelineConfig:
    eps: float = 0.35
    min_samples: int = 2
    min_det_score: float = 0.5
    det_size: int = 640
    providers: str = "CPUExecutionProvider"
    reassign_noise: bool = True
    noise_sim_threshold: float = 0.5

    @classmethod
    def from_dict(cls, data: dict | None) -> "PipelineConfig":
        payload = data or {}
        return cls(
            eps=float(payload.get("eps", 0.35)),
            min_samples=int(payload.get("minSamples", payload.get("min_samples", 2))),
            min_det_score=float(payload.get("minDetScore", payload.get("min_det_score", 0.5))),
            det_size=int(payload.get("detSize", payload.get("det_size", 640))),
            providers=str(payload.get("providers", "CPUExecutionProvider")),
            reassign_noise=bool(payload.get("reassignNoise", payload.get("reassign_noise", True))),
            noise_sim_threshold=float(
                payload.get("noiseSimThreshold", payload.get("noise_sim_threshold", 0.5))
            ),
        )


@dataclass
class FaceResult:
    image_id: str
    source_object_path: str
    face_index: int
    det_score: float
    bbox: Tuple[int, int, int, int]
    embedding: np.ndarray
    cluster_label: int
    crop_path: str | None


@dataclass
class ClusterResult:
    cluster_label: int
    face_count: int
    preview_crop_path: str | None


@dataclass
class PipelineRunResult:
    faces: List[FaceResult]
    clusters: List[ClusterResult]
    stats: Dict[str, float]


@dataclass
class _PendingFace:
    image_id: str
    source_object_path: str
    face_index: int
    det_score: float
    bbox: Tuple[int, int, int, int]
    embedding: np.ndarray
    crop_image: np.ndarray
    cluster_label: int = -1
    crop_path: str | None = None


def _decode_image(blob: bytes) -> np.ndarray | None:
    image_array = np.frombuffer(blob, dtype=np.uint8)
    if image_array.size == 0:
        return None
    return cv2.imdecode(image_array, cv2.IMREAD_COLOR)


def _encode_jpg(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image)
    if not ok:
        raise ValueError("Failed to encode image crop as JPEG")
    return bytes(buffer)


def run_pipeline(
    job_id: str,
    images: List[ImageInput],
    config: PipelineConfig,
    download_image: Callable[[str], bytes],
    upload_crop: Callable[[str, bytes], None],
) -> PipelineRunResult:
    started_at = time.perf_counter()
    providers = [p.strip() for p in config.providers.split(",") if p.strip()]
    app = make_face_app(providers=providers, det_size=config.det_size)

    pending_faces: List[_PendingFace] = []
    processed_images = 0

    for image in images:
        blob = download_image(image.object_path)
        frame = _decode_image(blob)
        if frame is None:
            continue
        processed_images += 1

        detected_faces = app.get(frame)
        valid_faces = [f for f in detected_faces if float(f.det_score) >= config.min_det_score]
        for idx, face in enumerate(valid_faces):
            bbox = tuple(int(v) for v in face.bbox[:4])
            embedding = l2_normalize(np.asarray(face.embedding, dtype=np.float32))
            crop = crop_with_margin(frame, bbox, margin=0.25)
            if crop.size == 0:
                continue
            pending_faces.append(
                _PendingFace(
                    image_id=image.id,
                    source_object_path=image.object_path,
                    face_index=idx,
                    det_score=float(face.det_score),
                    bbox=bbox,
                    embedding=embedding,
                    crop_image=crop,
                )
            )

    if not pending_faces:
        elapsed = time.perf_counter() - started_at
        return PipelineRunResult(
            faces=[],
            clusters=[],
            stats={
                "total_images": len(images),
                "processed_images": processed_images,
                "detected_faces": 0,
                "clusters_count": 0,
                "noise_faces": 0,
                "processing_seconds": round(elapsed, 3),
            },
        )

    embeddings = np.vstack([face.embedding for face in pending_faces]).astype(np.float32)
    labels = cluster_embeddings(
        embeddings=embeddings,
        eps=config.eps,
        min_samples=config.min_samples,
    )
    if config.reassign_noise:
        labels = reassign_noise_to_centroids(
            labels=labels,
            embeddings=embeddings,
            similarity_threshold=config.noise_sim_threshold,
        )

    for face, label in zip(pending_faces, labels.tolist()):
        face.cluster_label = int(label)
        cluster_name = "noise" if face.cluster_label == -1 else f"cluster_{face.cluster_label:04d}"
        crop_path = (
            f"jobs/{job_id}/clusters/{cluster_name}/"
            f"face_{face.image_id}_{face.face_index:03d}.jpg"
        )
        upload_crop(crop_path, _encode_jpg(face.crop_image))
        face.crop_path = crop_path

    cluster_to_faces: Dict[int, List[_PendingFace]] = {}
    for face in pending_faces:
        cluster_to_faces.setdefault(face.cluster_label, []).append(face)

    clusters: List[ClusterResult] = []
    for cluster_label in sorted(cluster_to_faces.keys()):
        faces = cluster_to_faces[cluster_label]
        preview_crop_path = faces[0].crop_path if faces else None
        clusters.append(
            ClusterResult(
                cluster_label=cluster_label,
                face_count=len(faces),
                preview_crop_path=preview_crop_path,
            )
        )

    faces: List[FaceResult] = [
        FaceResult(
            image_id=face.image_id,
            source_object_path=face.source_object_path,
            face_index=face.face_index,
            det_score=face.det_score,
            bbox=face.bbox,
            embedding=face.embedding,
            cluster_label=face.cluster_label,
            crop_path=face.crop_path,
        )
        for face in pending_faces
    ]

    non_noise_clusters = [cluster for cluster in clusters if cluster.cluster_label >= 0]
    noise_faces = len(cluster_to_faces.get(-1, []))
    elapsed = time.perf_counter() - started_at

    return PipelineRunResult(
        faces=faces,
        clusters=clusters,
        stats={
            "total_images": len(images),
            "processed_images": processed_images,
            "detected_faces": len(faces),
            "clusters_count": len(non_noise_clusters),
            "noise_faces": noise_faces,
            "processing_seconds": round(elapsed, 3),
        },
    )
