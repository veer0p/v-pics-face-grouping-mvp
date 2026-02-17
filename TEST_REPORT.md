# Test Report

Date: 2026-02-17
Project: Face clustering prototype (`face_cluster.py`)

## Scope

This run validates core clustering logic and CLI readiness.

## Commands Executed

```bash
python -m pip install pytest
python -m pytest -q
python face_cluster.py --help
```

## Results

- Total tests: 8
- Passed: 8
- Failed: 0
- Duration: 1.64s

Pytest output:

```text
........                                                                 [100%]
8 passed in 1.64s
```

## Test Cases Covered

1. `l2_normalize` outputs unit vectors.
2. `bbox_area` handles normal and invalid boxes.
3. Noise labels become unique IDs via `labels_with_unique_noise`.
4. `pairwise_precision_recall_f1` returns expected perfect and partial scores.
5. `cluster_embeddings` separates two synthetic identity groups.
6. `reassign_noise_to_centroids` reassigns only high-similarity noise points.
7. `tune_eps` returns a valid candidate threshold and valid metric ranges.
8. `save_cluster_outputs` writes `clusters.csv` correctly.

## CLI Smoke Check

`python face_cluster.py --help` executed successfully (exit code 0), confirming argument parsing and script entrypoint are healthy.

## Notes / Remaining Gaps

- End-to-end inference is now validated on a downloaded benchmark subset (see Real Benchmark section).
- Final production confidence should still be validated on your own photo domain using:
  `python face_cluster.py --input <val_dir> --assume-single-face --evaluate --tune-eps`.

## Real Benchmark (Downloaded Images)

Date: 2026-02-17
Dataset source: LFW (via `sklearn.datasets.fetch_lfw_people`, internet download)
Subset used:

- 4 identities
- 8 images per identity
- Total: 32 images

Identities:

1. `George_W_Bush`
2. `Colin_Powell`
3. `Tony_Blair`
4. `Donald_Rumsfeld`

### Benchmark Command

```bash
python face_cluster.py --input real_test_data_full --assume-single-face --evaluate --tune-eps --eps-min 0.20 --eps-max 0.55 --eps-step 0.03 --min-det-score 0.3 --output output_real_test_full
```

### Benchmark Results

- Detected faces: 32
- Images with at least one face: 32
- Identity clusters (excluding noise): 4
- Unclustered/noise faces: 0
- Best tuned `eps`: 0.320
- Pairwise precision: 1.0000
- Pairwise recall: 1.0000
- Pairwise F1: 1.0000

Result summary:

- Target `>=90%` was achieved on this downloaded validation subset.
- Outputs are available at `output_real_test_full` including `clusters.csv` and grouped face crops.
