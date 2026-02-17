"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { InitUploadResponse, UploadFileInput } from "@/types/api";

const MB = 1024 * 1024;
const MAX_FILES_PER_JOB = 30;

function formatBytes(value: number): string {
  if (value < MB) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / MB).toFixed(2)} MB`;
}

type UploadProgress = Record<string, "pending" | "uploaded" | "failed">;

export default function HomePage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [eps, setEps] = useState<string>("0.35");
  const [minSamples, setMinSamples] = useState<string>("2");
  const [minDetScore, setMinDetScore] = useState<string>("0.5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({});

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  async function startUpload() {
    setError(null);
    if (files.length === 0) {
      setError("Select at least one image.");
      return;
    }
    if (files.length > MAX_FILES_PER_JOB) {
      setError(`Maximum ${MAX_FILES_PER_JOB} images per job.`);
      return;
    }

    const numericEps = Number(eps);
    const numericMinSamples = Number(minSamples);
    const numericMinDetScore = Number(minDetScore);
    if (
      Number.isNaN(numericEps) ||
      Number.isNaN(numericMinSamples) ||
      Number.isNaN(numericMinDetScore)
    ) {
      setError("Config values must be valid numbers.");
      return;
    }

    setSubmitting(true);
    try {
      const uploadFiles: UploadFileInput[] = files.map((file) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      }));

      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: uploadFiles,
          config: {
            eps: numericEps,
            minSamples: numericMinSamples,
            minDetScore: numericMinDetScore,
          },
        }),
      });

      const initPayload = (await initRes.json()) as InitUploadResponse | { error: string };
      if (!initRes.ok || !("jobId" in initPayload)) {
        throw new Error("error" in initPayload ? initPayload.error : "Failed to init upload");
      }

      const nextProgress: UploadProgress = {};
      files.forEach((file) => {
        nextProgress[file.name] = "pending";
      });
      setProgress(nextProgress);

      if (initPayload.uploads.length !== files.length) {
        throw new Error("Upload descriptor count mismatch. Retry the job.");
      }

      for (let i = 0; i < initPayload.uploads.length; i += 1) {
        const descriptor = initPayload.uploads[i];
        const file = files[i];

        const uploadRes = await fetch(descriptor.signedUploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-upsert": "false",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          setProgress((previous) => ({ ...previous, [file.name]: "failed" }));
          throw new Error(`Failed to upload ${file.name}.`);
        }
        setProgress((previous) => ({ ...previous, [file.name]: "uploaded" }));
      }

      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: initPayload.jobId,
          objectPaths: initPayload.uploads.map((item) => item.objectPath),
        }),
      });
      const completePayload = (await completeRes.json()) as { status?: string; error?: string };
      if (!completeRes.ok || completePayload.status !== "queued") {
        throw new Error(completePayload.error ?? "Failed to enqueue job.");
      }

      router.push(`/jobs/${initPayload.jobId}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unexpected error.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <h1>Face Grouping MVP</h1>
        <p>
          Upload a small photo batch and group faces by person using Supabase storage + Python
          embedding pipeline.
        </p>
      </section>

      <section className="panel">
        <div className="field">
          <label htmlFor="photos">Photos ({files.length}/{MAX_FILES_PER_JOB})</label>
          <input
            id="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              setFiles(selected);
              setProgress({});
              setError(null);
            }}
          />
          <p className="hint">Keep it between 1 and 30 photos for this MVP.</p>
        </div>

        <div className="grid-two" style={{ marginTop: "0.9rem" }}>
          <div className="field">
            <label htmlFor="eps">EPS (DBSCAN)</label>
            <input
              id="eps"
              type="number"
              min="0.05"
              max="1"
              step="0.01"
              value={eps}
              onChange={(event) => setEps(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="minSamples">Min Samples</label>
            <input
              id="minSamples"
              type="number"
              min="1"
              max="20"
              step="1"
              value={minSamples}
              onChange={(event) => setMinSamples(event.target.value)}
            />
          </div>
        </div>

        <div className="grid-two" style={{ marginTop: "0.8rem" }}>
          <div className="field">
            <label htmlFor="minDetScore">Min Detection Score</label>
            <input
              id="minDetScore"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={minDetScore}
              onChange={(event) => setMinDetScore(event.target.value)}
            />
          </div>
          <div className="meta-item">
            <p>Total selected size</p>
            <p>{formatBytes(totalBytes)}</p>
          </div>
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={submitting} onClick={startUpload}>
            {submitting ? "Uploading..." : "Start Grouping"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={submitting}
            onClick={() => {
              setFiles([]);
              setProgress({});
              setError(null);
            }}
          >
            Clear
          </button>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {files.length > 0 ? (
          <div className="list" style={{ marginTop: "1rem" }}>
            {files.map((file) => {
              const state = progress[file.name] ?? "pending";
              return (
                <div className="row" key={`${file.name}-${file.size}`}>
                  <div>
                    <p>{file.name}</p>
                    <p className="hint">{formatBytes(file.size)}</p>
                  </div>
                  <span className="status-chip">{state}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
