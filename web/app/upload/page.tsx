"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import * as fflate from "fflate";
import { useUploadQueue } from "@/components/UploadQueueProvider";

const MAX_QUEUE_SIZE = 3000;
const ZIP_ENTRY_YIELD_STEP = 40;

const getFileSignature = (name: string, size: number) => `${name}|${size}`;

const getMimeFromExt = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg"].includes(ext || "")) return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    if (ext === "heic") return "image/heic";
    if (ext === "mp4") return "video/mp4";
    if (ext === "mov") return "video/quicktime";
    if (ext === "webm") return "video/webm";
    if (ext === "m4v") return "video/x-m4v";
    if (ext === "ogg" || ext === "ogv") return "video/ogg";
    return "application/octet-stream";
};

export default function UploadPage() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const { enqueueFiles, pendingItems, retryAll } = useUploadQueue();
    const [dragOver, setDragOver] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);

    // Queue stats
    const uploading = pendingItems.filter(i => i.status === "uploading").length;
    const queued = pendingItems.filter(i => i.status === "queued_upload" || i.status === "pending_hash").length;
    const uploaded = pendingItems.filter(i => i.status === "uploaded").length;
    const failed = pendingItems.filter(i => i.status === "failed").length;
    const total = pendingItems.length;
    const hasQueue = total > 0;

    const processZip = useCallback(async (zipFile: File): Promise<File[]> => {
        if (zipFile.size > 2 * 1024 * 1024 * 1024) {
            alert(`ZIP file "${zipFile.name}" is too large (2GB+). Please unzip locally and upload the folder/images.`);
            return [];
        }

        try {
            const zipBuffer = new Uint8Array(await zipFile.arrayBuffer());
            const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
                fflate.unzip(zipBuffer, (err, data) => {
                    if (err || !data) {
                        reject(err || new Error("ZIP extraction failed."));
                        return;
                    }
                    resolve(data as Record<string, Uint8Array>);
                });
            });

            const extracted: File[] = [];
            let processed = 0;
            for (const [name, data] of Object.entries(unzipped)) {
                processed += 1;
                if (processed % ZIP_ENTRY_YIELD_STEP === 0) {
                    await new Promise<void>((resolve) => setTimeout(resolve, 0));
                }

                if (name.includes("__MACOSX") || name.endsWith("/")) continue;
                const mime = getMimeFromExt(name);
                if (!mime.startsWith("image/") && !mime.startsWith("video/")) continue;

                // Copy bytes into a fresh ArrayBuffer-backed view for strict TS BlobPart typing.
                const bytes = new Uint8Array(data.byteLength);
                bytes.set(data);
                const blob = new Blob([bytes], { type: mime });
                extracted.push(new File([blob], name.split("/").pop() || name, { type: mime }));
            }

            return extracted;
        } catch (err) {
            console.error("ZIP extraction failed:", err);
            alert(`Failed to extract ZIP: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    }, []);

    const normalizeFiles = useCallback(async (incoming: FileList | File[]) => {
        const normalized: File[] = [];
        for (const file of Array.from(incoming)) {
            const isZip =
                file.name.toLowerCase().endsWith(".zip") ||
                file.type === "application/zip" ||
                file.type.includes("zip");
            if (isZip) {
                const zipFiles = await processZip(file);
                normalized.push(...zipFiles);
                continue;
            }
            if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
                normalized.push(file);
            }
        }

        const seen = new Set<string>();
        const deduped: File[] = [];
        for (const file of normalized) {
            const signature = getFileSignature(file.name, file.size);
            if (seen.has(signature)) continue;
            seen.add(signature);
            deduped.push(file);
        }

        if (deduped.length > MAX_QUEUE_SIZE) {
            alert(`Only first ${MAX_QUEUE_SIZE} files were accepted in this batch.`);
            return deduped.slice(0, MAX_QUEUE_SIZE);
        }

        return deduped;
    }, [processZip]);

    const enqueueAndNavigate = useCallback(async (incoming: FileList | File[]) => {
        if (processing) return;

        setProcessing(true);
        setError(null);
        try {
            const files = await normalizeFiles(incoming);
            if (files.length === 0) {
                setProcessing(false);
                return;
            }

            // Kick off queueing + background upload, then immediately move user to Photos.
            void enqueueFiles(files).catch((err) => {
                console.error("[UPLOAD-PAGE] enqueue failed:", err);
            });
            router.push("/");
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setProcessing(false);
        }
    }, [enqueueFiles, normalizeFiles, processing, router]);

    const handleRetryAll = async () => {
        setRetrying(true);
        await retryAll();
        setRetrying(false);
    };

    return (
        <div className="page-shell">
            <div style={{ marginBottom: "1.25rem" }}>
                <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>Bulk Upload</h1>
                <p style={{ fontSize: "0.84rem", color: "var(--muted)", marginTop: "0.35rem" }}>
                    Photos appear instantly in your gallery while uploads continue in background.
                </p>
            </div>

            {error && (
                <div style={{
                    marginBottom: "1rem",
                    background: "var(--error-soft)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "var(--error)",
                    borderRadius: "var(--r-md)",
                    padding: "0.8rem 1rem",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                }}>
                    {error}
                </div>
            )}

            <div
                className={`panel${dragOver ? " drag-over" : ""}`}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    padding: "4rem 2rem",
                    border: "2px dashed var(--line)",
                    borderRadius: "var(--r-lg)",
                    transition: "all 0.2s",
                    opacity: processing ? 0.7 : 1,
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!processing) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void enqueueAndNavigate(e.dataTransfer.files);
                }}
                onClick={() => !processing && inputRef.current?.click()}
            >
                <div style={{ padding: "1.25rem", borderRadius: "50%", background: "var(--accent-soft)" }}>
                    {processing ? <Loader size={36} className="spin" color="var(--accent)" /> : <Upload size={36} color="var(--accent)" />}
                </div>

                <div style={{ textAlign: "center" }}>
                    <p style={{ fontWeight: 700, fontSize: "1.2rem", marginBottom: "0.25rem" }}>
                        {processing ? "Preparing uploads..." : "Upload Photos & ZIPs"}
                    </p>
                    <p style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
                        Drag media files here or use the buttons below
                    </p>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                    <button
                        className="btn btn-primary"
                        disabled={processing}
                        onClick={(e) => {
                            e.stopPropagation();
                            inputRef.current?.click();
                        }}
                    >
                        Select Photos
                    </button>
                    <button
                        className="btn btn-secondary"
                        disabled={processing}
                        onClick={(e) => {
                            e.stopPropagation();
                            const zipInput = document.createElement("input");
                            zipInput.type = "file";
                            zipInput.multiple = true;
                            zipInput.accept = ".zip,application/zip";
                            zipInput.onchange = (event) => {
                                const target = event.target as HTMLInputElement | null;
                                if (!target?.files) return;
                                void enqueueAndNavigate(target.files);
                            };
                            zipInput.click();
                        }}
                    >
                        Select ZIP
                    </button>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    hidden
                    onChange={(event) => {
                        if (!event.target.files) return;
                        void enqueueAndNavigate(event.target.files);
                        event.target.value = "";
                    }}
                />
            </div>

            {/* Queue Status Summary */}
            {hasQueue && (
                <div style={{
                    marginTop: "1.5rem",
                    padding: "1rem 1.25rem",
                    background: "var(--glass-bg-card)",
                    backdropFilter: "blur(var(--glass-blur))",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--r-md)",
                    boxShadow: "var(--glow-shadow)",
                }}>
                    <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: "0.75rem",
                    }}>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Upload Queue</h3>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>{total} items</span>
                    </div>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "0.5rem",
                    }}>
                        {(uploading + queued) > 0 && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                padding: "0.6rem 0.75rem",
                                background: "var(--bg-subtle)", borderRadius: "var(--r-sm)",
                            }}>
                                <Loader size={16} className="spin" color="var(--accent)" />
                                <div>
                                    <p style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.1 }}>{uploading + queued}</p>
                                    <p style={{ fontSize: "0.7rem", color: "var(--muted)" }}>In Progress</p>
                                </div>
                            </div>
                        )}

                        {uploaded > 0 && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                padding: "0.6rem 0.75rem",
                                background: "var(--bg-subtle)", borderRadius: "var(--r-sm)",
                            }}>
                                <CheckCircle size={16} color="#4ade80" />
                                <div>
                                    <p style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.1 }}>{uploaded}</p>
                                    <p style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Backed Up</p>
                                </div>
                            </div>
                        )}

                        {failed > 0 && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                padding: "0.6rem 0.75rem",
                                background: "rgba(248,113,113,0.08)", borderRadius: "var(--r-sm)",
                            }}>
                                <AlertCircle size={16} color="#f87171" />
                                <div>
                                    <p style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.1, color: "#f87171" }}>{failed}</p>
                                    <p style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Failed</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {failed > 0 && (
                        <button
                            className="btn btn-secondary"
                            style={{
                                width: "100%", marginTop: "0.75rem",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: "0.4rem",
                            }}
                            onClick={handleRetryAll}
                            disabled={retrying}
                        >
                            {retrying ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
                            Retry All Failed ({failed})
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
