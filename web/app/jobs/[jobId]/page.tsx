"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { FaceInGroup, JobResultResponse } from "@/types/api";

function statusClass(status: string): string {
  return `status-chip status-${status}`;
}

type FacesByGroup = Record<string, FaceInGroup[]>;

export default function JobResultPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;
  const [payload, setPayload] = useState<JobResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const data = (await response.json()) as JobResultResponse | { error: string };
        if (!response.ok || !("job" in data)) {
          throw new Error("error" in data ? data.error : "Failed to fetch job");
        }
        if (stop) {
          return;
        }
        setPayload(data);
        setError(null);
        setLoading(false);

        if (data.job.status === "queued" || data.job.status === "processing" || data.job.status === "draft") {
          timer = setTimeout(poll, 2500);
        }
      } catch (caught) {
        if (stop) {
          return;
        }
        const message = caught instanceof Error ? caught.message : "Unexpected error.";
        setError(message);
        setLoading(false);
        timer = setTimeout(poll, 4000);
      }
    }

    void poll();
    return () => {
      stop = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [jobId]);

  const facesByGroup: FacesByGroup = useMemo(() => payload?.facesByGroup ?? {}, [payload]);

  return (
    <main className="page-shell">
      <section className="hero" style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem" }}>
        <div>
          <h1>Job Result</h1>
          <p className="mono">{jobId}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/")}>
          New Upload
        </button>
      </section>

      <section className="panel">
        {loading ? <p>Loading job status...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {payload ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
              <span className={statusClass(payload.job.status)}>{payload.job.status}</span>
              {payload.job.errorMessage ? <span className="warn-text">{payload.job.errorMessage}</span> : null}
            </div>

            <div className="meta-grid">
              <div className="meta-item">
                <p>Images</p>
                <p>{String(payload.job.stats.total_images ?? "-")}</p>
              </div>
              <div className="meta-item">
                <p>Detected Faces</p>
                <p>{String(payload.job.stats.detected_faces ?? "-")}</p>
              </div>
              <div className="meta-item">
                <p>Clusters</p>
                <p>{String(payload.job.stats.clusters_count ?? "-")}</p>
              </div>
              <div className="meta-item">
                <p>Noise Faces</p>
                <p>{String(payload.job.stats.noise_faces ?? "-")}</p>
              </div>
            </div>

            {payload.job.status === "completed" ? (
              <>
                {payload.groups.length > 0 ? (
                  <div className="group-grid">
                    {payload.groups.map((group) => {
                      const faces = facesByGroup[group.clusterId] ?? [];
                      return (
                        <article className="group-card" key={group.clusterId}>
                          <div className="group-header">
                            <strong>
                              {group.clusterLabel === -1
                                ? "Uncertain"
                                : `Person ${group.clusterLabel + 1}`}
                            </strong>
                            <span>{group.faceCount} faces</span>
                          </div>
                          {group.previewUrl ? (
                            <img className="group-preview" src={group.previewUrl} alt="Cluster preview" />
                          ) : (
                            <div className="group-preview" />
                          )}
                          <div className="group-body">
                            <p className="hint">Top faces</p>
                            <div className="thumb-grid">
                              {faces.slice(0, 8).map((face) => (
                                face.cropUrl ? (
                                  face.sourceImageUrl ? (
                                    <a
                                      key={face.faceId}
                                      href={face.sourceImageUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={`det_score: ${face.detScore.toFixed(3)} | open source image`}
                                    >
                                      <img className="thumb" src={face.cropUrl} alt="Face crop" />
                                    </a>
                                  ) : (
                                    <img
                                      className="thumb"
                                      key={face.faceId}
                                      src={face.cropUrl}
                                      alt="Face crop"
                                      title={`det_score: ${face.detScore.toFixed(3)}`}
                                    />
                                  )
                                ) : (
                                  <div className="thumb" key={face.faceId} />
                                )
                              ))}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ marginTop: "1rem" }}>No groups found for this job.</p>
                )}
              </>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
