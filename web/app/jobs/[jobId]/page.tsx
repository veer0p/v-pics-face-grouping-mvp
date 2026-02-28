"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, User, Shuffle, Check, X, AlertTriangle, Plus } from "lucide-react";
import type { ClusterGroup, FaceInGroup, JobResultResponse } from "@/types/api";

/* ── helpers ───────────────────────────────────────────── */
function statusClass(s: string) { return `status-chip status-${s}`; }

type StepKey = "queued" | "processing" | "grouping" | "completed";
const STEPS: { key: StepKey; label: string }[] = [
    { key: "queued", label: "Queued" },
    { key: "processing", label: "Detecting" },
    { key: "grouping", label: "Grouping" },
    { key: "completed", label: "Done" },
];

function stepIndex(status: string): number {
    if (status === "queued") return 0;
    if (status === "processing") return 2;
    if (status === "completed") return 4;
    if (status === "failed") return -1;
    return 0;
}

/* ── Lightbox ──────────────────────────────────────────── */
function Lightbox({
    faces, startIndex, onClose,
}: {
    faces: FaceInGroup[];
    startIndex: number;
    onClose: () => void;
}) {
    const [idx, setIdx] = useState(startIndex);
    const face = faces[idx];

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
            if (e.key === "ArrowRight") setIdx((i) => Math.min(faces.length - 1, i + 1));
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [faces.length, onClose]);

    if (!face?.cropUrl) return null;

    return (
        <div className="lightbox-overlay">
            <button className="lightbox-backdrop" onClick={onClose} aria-label="Close" />
            <div className="lightbox-shell">
                <div className="lightbox-header">
                    <span className="lightbox-badge">
                        {idx + 1} / {faces.length}
                    </span>
                    <span className="lightbox-badge" style={{ opacity: 0.85 }}>
                        Score: {face.detScore.toFixed(3)}
                    </span>
                    <button className="lightbox-close" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={2.5} /></button>
                </div>

                <div style={{ position: "relative", width: "100%" }}>
                    <button
                        className="lightbox-nav prev"
                        onClick={() => setIdx((i) => Math.max(0, i - 1))}
                        disabled={idx === 0}
                        aria-label="Previous"
                    >‹</button>

                    <img
                        className="lightbox-img"
                        src={face.cropUrl}
                        alt={`Face ${idx + 1}`}
                        key={face.faceId}
                    />

                    <button
                        className="lightbox-nav next"
                        onClick={() => setIdx((i) => Math.min(faces.length - 1, i + 1))}
                        disabled={idx === faces.length - 1}
                        aria-label="Next"
                    >›</button>
                </div>

                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.75rem", textAlign: "center" }}>
                    Left / Right arrow keys to navigate · Esc or click backdrop to close
                </p>
            </div>
        </div>
    );
}

/* ── Main page ─────────────────────────────────────────── */
export default function JobResultPage() {
    const params = useParams<{ jobId: string }>();
    const router = useRouter();
    const jobId = params.jobId;

    const [payload, setPayload] = useState<JobResultResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [names, setNames] = useState<Record<string, string>>({});
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [tagging, setTagging] = useState(false);
    const [lightbox, setLightbox] = useState<{ faces: FaceInGroup[]; idx: number } | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }

    async function fetchJob() {
        try {
            const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
            const data = (await res.json()) as JobResultResponse | { error: string };
            if (!res.ok || !("job" in data)) throw new Error("error" in data ? data.error : "Failed to fetch job");
            setPayload(data);
            setError(null);
            setLoading(false);
            // seed names
            setNames((prev) => {
                const next = { ...prev };
                data.groups.forEach((g: ClusterGroup) => {
                    if (!next[g.clusterId]) {
                        next[g.clusterId] = g.clusterLabel === -1 ? "Uncertain" : `Person ${g.clusterLabel + 1}`;
                    }
                });
                return next;
            });
            return data;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unexpected error.");
            setLoading(false);
            return null;
        }
    }

    useEffect(() => {
        let stop = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        async function poll() {
            const data = await fetchJob();
            if (stop) return;
            if (data && ["queued", "processing", "draft"].includes(data.job.status)) {
                timer = setTimeout(poll, 2500);
            }
        }
        void poll();
        return () => { stop = true; if (timer) clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId]);

    const facesByGroup = useMemo(
        () => payload?.facesByGroup ?? {},
        [payload]
    );

    const toggleFace = (faceId: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(faceId)) next.delete(faceId); else next.add(faceId);
            return next;
        });

    const handleTag = async (targetId: string) => {
        setTagging(true);
        try {
            await Promise.all([...selected].map((faceId) =>
                fetch(`/api/faces/${faceId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clusterId: targetId }),
                })
            ));
            setSelected(new Set());
            await fetchJob();
            showToast("Faces moved successfully");
        } catch {
            setError("Failed to update tags.");
        } finally {
            setTagging(false);
        }
    };

    const activeStep = stepIndex(payload?.job.status ?? "queued");
    const isProcessing = payload && ["queued", "processing", "draft"].includes(payload.job.status);

    return (
        <div className="page-shell">
            {/* ── Header ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "2.5rem" }}>
                <div>
                    <h1 style={{
                        fontFamily: "var(--font-display)",
                        fontStyle: "italic",
                        fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                    }}>
                        Job Result
                    </h1>
                    <p className="mono" style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                        {jobId}
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={() => router.push("/")} style={{ padding: '0.65rem 1.25rem' }}>
                    + New Upload
                </button>
            </div>

            {/* ── Progress Stepper ── */}
            {payload && (
                <div style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                        <span className={statusClass(payload.job.status)}>
                            <span className="status-dot" />
                            {payload.job.status}
                        </span>
                        {isProcessing && (
                            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                                Checking every 2.5s…
                            </span>
                        )}
                        {payload.job.errorMessage && (
                            <span className="warn-text">{payload.job.errorMessage}</span>
                        )}
                    </div>

                    <div className="stepper">
                        {STEPS.map((step, i) => {
                            const stepPos = i * 1.5;
                            const done = activeStep > stepPos;
                            const active = !done && activeStep >= stepPos && payload.job.status !== "failed";
                            return (
                                <div
                                    key={step.key}
                                    className={`stepper-step${done ? " done" : active ? " active" : ""}`}
                                >
                                    <div className="stepper-circle">
                                        {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                                    </div>
                                    <span className="stepper-label">{step.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Loading / Error ── */}
            {loading && (
                <div style={{ padding: "2rem 0", textAlign: "center" }}>
                    <div className="responsive-grid" style={{ gap: "1rem", marginBottom: "2rem" }}>
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="skeleton" style={{ height: 100, borderRadius: "var(--r-md)" }} />
                        ))}
                    </div>
                    <div className="skeleton" style={{ height: 300, borderRadius: "var(--r-lg)" }} />
                </div>
            )}
            {error && (
                <div style={{
                    padding: "1rem 1.25rem", background: "var(--error-soft)", borderRadius: "var(--r-sm)",
                    color: "var(--error)", fontWeight: 600, fontSize: "0.95rem", marginBottom: '2rem'
                }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><AlertTriangle size={18} strokeWidth={2.5} /> {error}</span>
                </div>
            )}

            {/* ── Stats ── */}
            {payload && (
                <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                    {[
                        { label: "Images", value: payload.job.stats.total_images ?? "–" },
                        { label: "Detected", value: payload.job.stats.detected_faces ?? "–" },
                        { label: "Clusters", value: payload.job.stats.clusters_count ?? "–" },
                        { label: "Noise", value: payload.job.stats.noise_faces ?? "–" },
                    ].map((s) => (
                        <div className="stat-card" key={s.label} style={{ padding: '1.25rem' }}>
                            <div className="stat-card-value"
                                style={{ fontFamily: "var(--font-display)", fontStyle: 'italic', fontSize: '1.75rem' }}>
                                {String(s.value)}
                            </div>
                            <div className="stat-card-label" style={{ fontSize: '0.85rem' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Cluster Cards ── */}
            {payload?.job.status === "completed" && (
                <>
                    {payload.groups.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-state-icon"><Search size={32} strokeWidth={1.5} /></span>
                            <p className="empty-state-title">No groups found</p>
                            <p className="empty-state-sub">Try adjusting the EPS or detection score and re-upload.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                                <p className="section-heading">People Found</p>
                                {selected.size > 0 && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
                                        Cancel selection
                                    </button>
                                )}
                            </div>
                            <div className="people-grid">
                                {payload.groups.map((group) => {
                                    const faces = facesByGroup[group.clusterId] ?? [];
                                    const name = names[group.clusterId] ?? `Person ${group.clusterLabel + 1}`;
                                    return (
                                        <article className="person-card" key={group.clusterId}>
                                            {/* Preview image */}
                                            {group.previewUrl ? (
                                                <img
                                                    className="person-card-preview"
                                                    src={group.previewUrl}
                                                    alt={name}
                                                    onClick={() => faces.length > 0 && setLightbox({ faces, idx: 0 })}
                                                    style={{ cursor: faces.length > 0 ? "pointer" : "default" }}
                                                />
                                            ) : (
                                                <div
                                                    className="person-card-preview-placeholder"
                                                    onClick={() => faces.length > 0 && setLightbox({ faces, idx: 0 })}
                                                    style={{ cursor: faces.length > 0 ? "pointer" : "default" }}
                                                >
                                                    <User size={28} strokeWidth={1.5} color="rgba(255,255,255,0.5)" />
                                                </div>
                                            )}

                                            {/* Card body */}
                                            <div className="person-card-body">
                                                <input
                                                    className="person-name-edit"
                                                    value={name}
                                                    onChange={(e) => setNames((p) => ({ ...p, [group.clusterId]: e.target.value }))}
                                                    placeholder={group.clusterLabel === -1 ? "Uncertain" : `Person ${group.clusterLabel + 1}`}
                                                    aria-label="Person name"
                                                />
                                                <p className="person-card-meta">{group.faceCount} faces detected</p>
                                                {group.clusterLabel === -1 && (
                                                    <span className="person-card-badge"><Shuffle size={12} strokeWidth={2} /> Uncertain</span>
                                                )}

                                                {/* Face thumbnails */}
                                                <div className="face-thumb-grid">
                                                    {faces.slice(0, 10).map((face, fi) => {
                                                        if (!face.cropUrl) return null;
                                                        const isSel = selected.has(face.faceId);
                                                        return (
                                                            <div
                                                                key={face.faceId}
                                                                className={`face-thumb-wrap${isSel ? " selected" : ""}`}
                                                                onClick={() => {
                                                                    if (selected.size > 0) {
                                                                        toggleFace(face.faceId);
                                                                    } else {
                                                                        setLightbox({ faces, idx: fi });
                                                                    }
                                                                }}
                                                                onContextMenu={(e) => { e.preventDefault(); toggleFace(face.faceId); }}
                                                                title={`Score: ${face.detScore.toFixed(3)} · Right-click/long-press to select`}
                                                            >
                                                                <img className="face-thumb-img" src={face.cropUrl} alt="Face crop" />
                                                                <div className="face-thumb-check"><Check size={12} strokeWidth={3} /></div>
                                                                <div className="face-thumb-score">{face.detScore.toFixed(2)}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {faces.length > 10 && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ marginTop: "0.5rem", width: "100%" }}
                                                        onClick={() => setLightbox({ faces, idx: 0 })}
                                                    >
                                                        View all {faces.length} faces
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ── Re-tag Action Bar ── */}
            {selected.size > 0 && (
                <div className="retag-bar glass">
                    <p className="retag-bar-title">
                        Move {selected.size} face{selected.size !== 1 ? "s" : ""} to:
                    </p>
                    <div className="retag-bar-options">
                        {payload?.groups.map((g) => (
                            <button
                                key={g.clusterId}
                                className="btn btn-secondary btn-sm"
                                disabled={tagging}
                                onClick={() => handleTag(g.clusterId)}
                            >
                                {names[g.clusterId] ?? (g.clusterLabel === -1 ? "Uncertain" : `Person ${g.clusterLabel + 1}`)}
                            </button>
                        ))}
                        <button
                            className="btn btn-ghost btn-sm"
                            disabled={tagging}
                            onClick={() => setSelected(new Set())}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Lightbox ── */}
            {lightbox && (
                <Lightbox
                    faces={lightbox.faces}
                    startIndex={lightbox.idx}
                    onClose={() => setLightbox(null)}
                />
            )}

            {/* ── Toast ── */}
            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}
