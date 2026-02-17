from pathlib import Path

import numpy as np

from face_cluster import (
    FaceRecord,
    bbox_area,
    cluster_embeddings,
    l2_normalize,
    labels_with_unique_noise,
    pairwise_precision_recall_f1,
    reassign_noise_to_centroids,
    save_cluster_outputs,
    tune_eps,
)


def test_l2_normalize_produces_unit_vector() -> None:
    vec = np.array([3.0, 4.0], dtype=np.float32)
    out = l2_normalize(vec)
    assert np.isclose(np.linalg.norm(out), 1.0)
    assert np.allclose(out, np.array([0.6, 0.8], dtype=np.float32), atol=1e-6)


def test_bbox_area_handles_invalid_box() -> None:
    assert bbox_area([0, 0, 10, 20]) == 200
    assert bbox_area([5, 5, 2, 3]) == 0


def test_labels_with_unique_noise_are_distinct() -> None:
    labels = [-1, -1, 2, -1, 2]
    out = labels_with_unique_noise(labels)
    assert out == ["noise_0", "noise_1", "cluster_2", "noise_2", "cluster_2"]


def test_pairwise_precision_recall_f1_perfect_and_partial() -> None:
    y_true = ["A", "A", "B", "B"]
    p, r, f1 = pairwise_precision_recall_f1(y_true, [0, 0, 1, 1])
    assert p == 1.0
    assert r == 1.0
    assert f1 == 1.0

    p2, r2, f12 = pairwise_precision_recall_f1(y_true, [0, -1, 1, 1])
    assert np.isclose(p2, 1.0)
    assert np.isclose(r2, 0.5)
    assert np.isclose(f12, 2.0 / 3.0)


def test_cluster_embeddings_finds_two_groups() -> None:
    emb = np.array(
        [
            l2_normalize(np.array([1.0, 0.0], dtype=np.float32)),
            l2_normalize(np.array([0.98, 0.02], dtype=np.float32)),
            l2_normalize(np.array([-1.0, 0.0], dtype=np.float32)),
            l2_normalize(np.array([-0.98, -0.02], dtype=np.float32)),
        ],
        dtype=np.float32,
    )
    labels = cluster_embeddings(emb, eps=0.05, min_samples=2)
    assert set(labels.tolist()) == {0, 1}
    counts = sorted([(labels == c).sum() for c in set(labels.tolist())])
    assert counts == [2, 2]


def test_reassign_noise_to_centroids_moves_only_high_similarity() -> None:
    emb = np.array(
        [
            l2_normalize(np.array([1.0, 0.0], dtype=np.float32)),
            l2_normalize(np.array([0.9, 0.1], dtype=np.float32)),
            l2_normalize(np.array([0.0, 1.0], dtype=np.float32)),
            l2_normalize(np.array([0.1, 0.9], dtype=np.float32)),
            l2_normalize(np.array([0.95, 0.05], dtype=np.float32)),
            l2_normalize(np.array([-0.8, -0.6], dtype=np.float32)),
        ],
        dtype=np.float32,
    )
    labels = np.array([0, 0, 1, 1, -1, -1], dtype=np.int32)
    out = reassign_noise_to_centroids(labels, emb, similarity_threshold=0.8)
    assert out[4] == 0
    assert out[5] == -1


def test_tune_eps_returns_candidate_and_valid_scores() -> None:
    emb = np.array(
        [
            l2_normalize(np.array([1.0, 0.0], dtype=np.float32)),
            l2_normalize(np.array([0.96, 0.04], dtype=np.float32)),
            l2_normalize(np.array([0.0, 1.0], dtype=np.float32)),
            l2_normalize(np.array([0.04, 0.96], dtype=np.float32)),
        ],
        dtype=np.float32,
    )
    y_true = ["A", "A", "B", "B"]
    eps, p, r, f1 = tune_eps(
        embeddings=emb,
        y_true=y_true,
        min_samples=2,
        eps_min=0.01,
        eps_max=0.30,
        eps_step=0.01,
        reassign_noise=False,
        noise_sim_threshold=0.5,
    )
    assert 0.01 <= eps <= 0.30
    assert 0.0 <= p <= 1.0
    assert 0.0 <= r <= 1.0
    assert 0.0 <= f1 <= 1.0


def test_save_cluster_outputs_writes_csv(tmp_path: Path) -> None:
    records = [
        FaceRecord(
            face_id=0,
            image_path=Path("a.jpg"),
            parent_label="Rahul",
            bbox=(1, 2, 3, 4),
            det_score=0.99,
            embedding=np.array([1.0, 0.0], dtype=np.float32),
        ),
        FaceRecord(
            face_id=1,
            image_path=Path("b.jpg"),
            parent_label="Aisha",
            bbox=(10, 20, 30, 40),
            det_score=0.88,
            embedding=np.array([0.0, 1.0], dtype=np.float32),
        ),
    ]
    labels = np.array([0, -1], dtype=np.int32)
    save_cluster_outputs(tmp_path, records, labels, save_crops=False)

    csv_path = tmp_path / "clusters.csv"
    assert csv_path.exists()
    lines = csv_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 3
    assert "face_id,cluster_id,image_path,parent_label" in lines[0]
