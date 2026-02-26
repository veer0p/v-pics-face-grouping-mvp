"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FolderOpen, Link2, CloudUpload, Settings, ChevronDown, AlertTriangle, Rocket, X, Check } from "lucide-react";
import type { InitUploadResponse, UploadFileInput } from "@/types/api";

const MB = 1024 * 1024;
const MAX_FILES = 30;

function fmt(bytes: number) {
    return bytes < MB ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / MB).toFixed(2)} MB`;
}

type UploadState = "idle" | "uploading" | "done" | "failed";
type FileProgress = Record<string, "pending" | "uploaded" | "failed">;

export default function HomePage() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<Record<string, string>>({});
    const [dragOver, setDragOver] = useState(false);
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [progress, setProgress] = useState<FileProgress>({});
    const [error, setError] = useState<string | null>(null);
    const [settingsOpen, setSettings] = useState(false);

    // Algorithm settings
    const [eps, setEps] = useState("0.35");
    const [minSamples, setMinSamples] = useState("2");
    const [minDetScore, setMinDetScore] = useState("0.5");

    const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);
    const submitting = uploadState === "uploading";

    const addFiles = useCallback((incoming: File[]) => {
        setError(null);
        setProgress({});
        setFiles((prev) => {
            const names = new Set(prev.map((f) => f.name));
            const merged = [...prev, ...incoming.filter((f) => !names.has(f.name))].slice(0, MAX_FILES);
            // generate previews
            merged.forEach((f) => {
                if (!previews[f.name]) {
                    const url = URL.createObjectURL(f);
                    setPreviews((p) => ({ ...p, [f.name]: url }));
                }
            });
            return merged;
        });
    }, [previews]);

    const removeFile = (name: string) => {
        setFiles((prev) => prev.filter((f) => f.name !== name));
        setPreviews((prev) => {
            const next = { ...prev };
            if (next[name]) URL.revokeObjectURL(next[name]);
            delete next[name];
            return next;
        });
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        addFiles(dropped);
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files ?? []);
        addFiles(selected);
        e.target.value = "";
    };

    async function startUpload() {
        setError(null);
        if (files.length === 0) { setError("Select at least one image."); return; }
        if (files.length > MAX_FILES) { setError(`Max ${MAX_FILES} images.`); return; }

        const eps_n = Number(eps);
        const ms_n = Number(minSamples);
        const mds_n = Number(minDetScore);
        if (isNaN(eps_n) || isNaN(ms_n) || isNaN(mds_n)) { setError("Invalid config values."); return; }

        setUploadState("uploading");
        try {
            const uploadFiles: UploadFileInput[] = files.map((f) => ({
                name: f.name, type: f.type || "application/octet-stream", size: f.size,
            }));

            const initRes = await fetch("/api/upload/init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ files: uploadFiles, config: { eps: eps_n, minSamples: ms_n, minDetScore: mds_n } }),
            });
            const initData = (await initRes.json()) as InitUploadResponse | { error: string };
            if (!initRes.ok || !("jobId" in initData)) throw new Error("error" in initData ? initData.error : "Init failed");

            const next: FileProgress = {};
            files.forEach((f) => { next[f.name] = "pending"; });
            setProgress(next);

            for (let i = 0; i < initData.uploads.length; i++) {
                const desc = initData.uploads[i];
                const file = files[i];
                const res = await fetch(desc.signedUploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
                    body: file,
                });
                if (!res.ok) {
                    setProgress((p) => ({ ...p, [file.name]: "failed" }));
                    throw new Error(`Failed to upload ${file.name}.`);
                }
                setProgress((p) => ({ ...p, [file.name]: "uploaded" }));
            }

            const compRes = await fetch("/api/upload/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId: initData.jobId, objectPaths: initData.uploads.map((u) => u.objectPath) }),
            });
            const compData = (await compRes.json()) as { status?: string; error?: string };
            if (!compRes.ok || compData.status !== "queued") throw new Error(compData.error ?? "Failed to enqueue.");

            setUploadState("done");
            router.push(`/jobs/${initData.jobId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error.");
            setUploadState("failed");
        }
    }

    const uploadedCount = Object.values(progress).filter((s) => s === "uploaded").length;
    const totalCount = files.length;

    return (
        <div className="page-shell">
            {/* ── Hero ── */}
            <div style={{ marginBottom: "1.5rem", paddingTop: "0.5rem" }}>
                <h1 style={{
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    color: "var(--ink)",
                    fontStyle: "italic",
                }}>
                    Group faces in<br />your photos
                </h1>
                <p style={{ color: "var(--muted)", marginTop: "0.4rem", fontSize: "0.92rem" }}>
                    Upload up to {MAX_FILES} photos and our AI will cluster faces by person.
                </p>
            </div>

            {/* ── Drag &amp; Drop Zone ── */}
            <div
                className={`drag-zone${dragOver ? " drag-over" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                aria-label="Upload photos"
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={onInputChange}
                    id="photo-upload-input"
                />
                <div className="drag-zone-icon"><Camera size={32} strokeWidth={1.5} /></div>
                <p className="drag-zone-title">
                    {dragOver ? "Drop photos here" : "Tap to select photos"}
                </p>
                <p className="drag-zone-sub">or drag &amp; drop · JPG, PNG, WEBP · up to {MAX_FILES} photos</p>
                {files.length > 0 && (
                    <span className="chip active" style={{ marginTop: "0.5rem" }}
                        onClick={(e) => { e.stopPropagation(); }}>
                        {files.length} photo{files.length !== 1 ? "s" : ""} · {fmt(totalBytes)}
                    </span>
                )}
            </div>

            {/* ── Photo Previews ── */}
            {files.length > 0 && (
                <div className="photo-preview-grid">
                    {files.map((file) => {
                        const state = progress[file.name];
                        return (
                            <div className="photo-preview-item" key={file.name}>
                                {previews[file.name] && (
                                    <img className="photo-preview-img" src={previews[file.name]} alt={file.name} />
                                )}
                                {state === "uploaded" && (
                                    <div className="photo-preview-ring done">✓</div>
                                )}
                                {state === "failed" && (
                                    <div className="photo-preview-ring failed">✕</div>
                                )}
                                {state === "pending" && (
                                    <div className="photo-preview-ring">
                                        <svg width="24" height="24" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
                                            <circle cx="12" cy="12" r="9" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                )}
                                {!state && !submitting && (
                                    <button
                                        className="photo-preview-remove"
                                        onClick={() => removeFile(file.name)}
                                        aria-label={`Remove ${file.name}`}
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Import From ── */}
            {files.length === 0 && (
                <>
                    <div className="divider">or import from</div>
                    <div className="import-grid">
                        <button className="import-card" onClick={() => inputRef.current?.click()}>
                            <span className="import-card-icon"><FolderOpen size={22} strokeWidth={1.8} /></span>
                            Files
                        </button>
                        <button className="import-card" onClick={() => inputRef.current?.click()}>
                            <span className="import-card-icon"><Camera size={22} strokeWidth={1.8} /></span>
                            Camera
                        </button>
                        <button className="import-card" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                            <span className="import-card-icon"><Link2 size={22} strokeWidth={1.8} /></span>
                            URL (soon)
                        </button>
                        <button className="import-card" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                            <span className="import-card-icon"><CloudUpload size={22} strokeWidth={1.8} /></span>
                            Drive (soon)
                        </button>
                    </div>
                </>
            )}

            {/* ── Advanced Settings Accordion ── */}
            <div className="accordion" style={{ marginTop: "1.25rem" }}>
                <button
                    className="accordion-trigger"
                    onClick={() => setSettings((o) => !o)}
                    aria-expanded={settingsOpen}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><Settings size={16} strokeWidth={2} /> Advanced Settings</span>
                    <span className={`accordion-chevron${settingsOpen ? " open" : ""}`}><ChevronDown size={16} strokeWidth={2.5} /></span>
                </button>
                <div className={`accordion-body${settingsOpen ? " open" : ""}`}>
                    <div className="accordion-body-inner">
                        <div className="grid-two">
                            <div className="field">
                                <label htmlFor="eps">DBSCAN EPS</label>
                                <input id="eps" type="number" min="0.05" max="1" step="0.01" value={eps}
                                    onChange={(e) => setEps(e.target.value)} />
                                <span className="hint">Cluster radius (0.05–1)</span>
                            </div>
                            <div className="field">
                                <label htmlFor="minSamples">Min Samples</label>
                                <input id="minSamples" type="number" min="1" max="20" step="1" value={minSamples}
                                    onChange={(e) => setMinSamples(e.target.value)} />
                                <span className="hint">Min faces per cluster</span>
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="minDetScore">Min Detection Score</label>
                            <input id="minDetScore" type="number" min="0" max="1" step="0.01" value={minDetScore}
                                onChange={(e) => setMinDetScore(e.target.value)} />
                            <span className="hint">Skip faces below this confidence (0–1)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div style={{
                    marginTop: "0.85rem",
                    padding: "0.65rem 0.9rem",
                    background: "var(--error-soft)",
                    borderRadius: "var(--r-sm)",
                    color: "var(--error)",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}><AlertTriangle size={15} strokeWidth={2.5} /> {error}</span>
                </div>
            )}

            {/* ── Upload Progress ── */}
            {submitting && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                    Uploading {uploadedCount} / {totalCount} photos…
                </div>
            )}

            {/* ── Actions ── */}
            <div style={{ display: "flex", gap: "0.65rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
                <button
                    className="btn btn-primary"
                    disabled={submitting || files.length === 0}
                    onClick={startUpload}
                    style={{ flex: 1, minWidth: 160 }}
                >
                    {submitting ? `Uploading… ${uploadedCount}/${totalCount}` : <><Rocket size={16} strokeWidth={2} /> Start Grouping</>}
                </button>
                {files.length > 0 && (
                    <button
                        className="btn btn-secondary"
                        disabled={submitting}
                        onClick={() => { setFiles([]); setPreviews({}); setProgress({}); setError(null); setUploadState("idle"); }}
                    >
                        Clear
                    </button>
                )}
            </div>

            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
