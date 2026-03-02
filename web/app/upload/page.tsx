"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Upload, CheckCircle, AlertTriangle, Loader,
    RefreshCw, SkipForward
} from "lucide-react";
import * as fflate from "fflate";
import { extractBrowserExif, uploadToB2, calculateHash, testB2Connectivity, generateThumbnail } from "@/lib/upload-utils";
import { PhotoMetadataCache } from "@/lib/photo-cache";

type FileEntry = {
    id: string;
    file: File;
    name: string;
    size: number;
    preview?: string;
    status: "pending" | "processing" | "uploading" | "done" | "error" | "duplicate";
    progress: number;
    error?: string;
};

const CONCURRENT_UPLOADS = 4;
const MAX_QUEUE_SIZE = 3000;
const ZIP_ENTRY_YIELD_STEP = 40;

const makeId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const getUploadConcurrency = () => {
    if (typeof navigator === "undefined") return CONCURRENT_UPLOADS;
    const cpu = navigator.hardwareConcurrency || CONCURRENT_UPLOADS;
    return Math.min(8, Math.max(3, Math.floor(cpu / 2)));
};

const getFileSignature = (name: string, size: number) => `${name}|${size}`;
const getMimeFromExt = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg"].includes(ext || "")) return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    if (ext === "heic") return "image/heic";
    return "application/octet-stream";
};

const buildEntry = (file: File, displayName?: string): FileEntry => ({
    id: makeId(),
    file,
    name: displayName || file.name,
    size: file.size,
    preview: URL.createObjectURL(file),
    status: "pending",
    progress: 0,
});

export default function UploadPage() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [stats, setStats] = useState({ done: 0, total: 0, errors: 0, duplicates: 0 });
    const [b2Status, setB2Status] = useState<"idle" | "testing" | "ok" | "fail">("idle");
    const [b2Error, setB2Error] = useState<string | null>(null);

    const processZip = useCallback(async (zipFile: File): Promise<FileEntry[]> => {
        // SAFETY: browser-side extraction still needs an upper bound.
        if (zipFile.size > 2 * 1024 * 1024 * 1024) {
            alert(`ZIP file "${zipFile.name}" is too large (2GB+) for browser extraction. Please unzip it locally and upload the folder.`);
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

            const extracted: FileEntry[] = [];
            let processed = 0;

            for (const [name, data] of Object.entries(unzipped)) {
                processed += 1;
                if (processed % ZIP_ENTRY_YIELD_STEP === 0) {
                    await new Promise<void>((resolve) => setTimeout(resolve, 0));
                }

                if (name.includes("__MACOSX") || name.endsWith("/")) continue;
                const mime = getMimeFromExt(name);
                if (!mime.startsWith("image/")) continue;

                const blob = new Blob([data], { type: mime });
                const file = new File([blob], name.split("/").pop() || name, { type: mime });
                extracted.push(buildEntry(file, name));
            }

            return extracted;
        } catch (err) {
            console.error("ZIP Error:", err);
            alert(`Failed to extract ZIP: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    }, []);

    const addFiles = useCallback(async (incoming: FileList | File[]) => {
        const nextEntries: FileEntry[] = [];

        for (const file of Array.from(incoming)) {
            const isZip =
                file.name.toLowerCase().endsWith(".zip") ||
                file.type === "application/zip" ||
                file.type.includes("zip");

            if (isZip) {
                const zipEntries = await processZip(file);
                nextEntries.push(...zipEntries);
                continue;
            }

            if (file.type.startsWith("image/")) {
                nextEntries.push(buildEntry(file));
            }
        }

        if (nextEntries.length === 0) return;

        setEntries((prev) => {
            const signatures = new Set(prev.map((entry) => getFileSignature(entry.name, entry.size)));
            const deduped: FileEntry[] = [];

            for (const entry of nextEntries) {
                const signature = getFileSignature(entry.name, entry.size);
                if (signatures.has(signature)) {
                    if (entry.preview) URL.revokeObjectURL(entry.preview);
                    continue;
                }
                signatures.add(signature);
                deduped.push(entry);
            }

            const remainingSlots = Math.max(MAX_QUEUE_SIZE - prev.length, 0);
            const accepted = deduped.slice(0, remainingSlots);
            const dropped = deduped.slice(remainingSlots);

            for (const entry of dropped) {
                if (entry.preview) URL.revokeObjectURL(entry.preview);
            }

            if (dropped.length > 0) {
                alert(`Upload queue is capped at ${MAX_QUEUE_SIZE} files. ${dropped.length} file(s) were skipped.`);
            }

            return [...prev, ...accepted];
        });
    }, [processZip]);

    const runUpload = async (queue: FileEntry[]) => {
        if (queue.length === 0) return;

        setUploading(true);
        setStats(s => ({ ...s, total: s.total + queue.length }));
        const concurrency = Math.min(getUploadConcurrency(), queue.length);
        let index = 0;
        let localErrors = 0;

        const uploadOne = async (entry: FileEntry) => {
            updateStatus(entry.id, "processing", 10, undefined);

            let originalKey: string | undefined;
            let thumbKey: string | undefined;

            try {
                // 1. SHA-256 Hashing & EXIF (Parallel)
                // Hashing for large files is now memory-safe (Quick Fingerprint)
                const [hash, exif] = await Promise.all([
                    calculateHash(entry.file).catch(() => null),
                    extractBrowserExif(entry.file).catch(() => ({ metadata: {}, takenAt: null, width: 0, height: 0 }))
                ]);

                // 2. Presigned URL from Server
                updateStatus(entry.id, "processing", 30);
                const preRes = await fetch(`/api/upload/presign?filename=${encodeURIComponent(entry.name)}&type=${entry.file.type}`);
                if (!preRes.ok) throw new Error(`Presign API Error: ${preRes.status}`);
                const presigned = await preRes.json();
                originalKey = presigned.originalKey;
                thumbKey = presigned.thumbKey;
                const { uploadUrl, thumbUploadUrl, fileId } = presigned;

                // 3. Direct Upload to B2 (Original + Thumbnail)
                updateStatus(entry.id, "uploading", 30);

                // Original
                const uploadPromise = uploadToB2(entry.file, uploadUrl, (p) => {
                    updateStatus(entry.id, "uploading", 30 + (p * 0.5));
                });

                // Thumbnail (Parallel generation and upload)
                const thumbPromise = (async () => {
                    try {
                        const thumbBlob = await generateThumbnail(entry.file);
                        const thumbFile = new File([thumbBlob], `thumb_${entry.name}`, { type: "image/webp" });
                        await uploadToB2(thumbFile, thumbUploadUrl, () => { });
                    } catch (err) {
                        console.warn("Thumbnail upload failed:", err);
                        // We don't fail the whole upload if just the thumbnail fails
                    }
                })();

                await Promise.all([uploadPromise, thumbPromise]).catch(async err => {
                    // Cleanup if one of them failed (original might have succeeded)
                    await fetch("/api/upload/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ originalKey: originalKey || null, thumbKey: thumbKey || null }),
                    }).catch(() => { }); // Ignore cleanup errors
                    throw new Error(`B2 Upload Failure (CORS or Network): ${err.message}`);
                });

                // 4. Notify DB Completion & Check for Duplicates
                const compRes = await fetch("/api/upload/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: fileId,
                        original_key: originalKey,
                        original_name: entry.name,
                        thumb_key: thumbKey,
                        mime_type: entry.file.type,
                        size_bytes: entry.file.size,
                        width: exif.width,
                        height: exif.height,
                        taken_at: exif.takenAt,
                        content_hash: hash,
                        metadata: exif.metadata,
                    }),
                });

                const compData = await compRes.json();

                if (!compRes.ok) {
                    // Check if it's a unique constraint error (duplicate)
                    if (compData.error?.includes("duplicate") || compRes.status === 409 || (compRes.status === 500 && compData.error?.includes("duplicate"))) {
                        updateStatus(entry.id, "duplicate", 100);
                        setStats(s => ({ ...s, duplicates: s.duplicates + 1 }));
                        return;
                    }
                    // Rollback B2 if DB insertion failed (safety measure, though server also does this)
                    await fetch("/api/upload/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ originalKey: originalKey || null, thumbKey: thumbKey || null }),
                    }).catch(() => { });

                    throw new Error(`DB Completion Error: ${compData.error || compRes.status}`);
                }

                updateStatus(entry.id, "done", 100);
                setStats(s => ({ ...s, done: s.done + 1 }));
            } catch (err: unknown) {
                console.error(`Upload error for ${entry.name}:`, err);
                const message = err instanceof Error ? err.message : String(err);
                updateStatus(entry.id, "error", 0, message);
                setStats(s => ({ ...s, errors: s.errors + 1 }));
                localErrors += 1;
            }
        };

        const worker = async () => {
            while (true) {
                const current = queue[index++];
                if (!current) break;
                await uploadOne(current);
            }
        };

        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        setUploading(false);

        if (localErrors === 0) {
            await PhotoMetadataCache.clear();
            await PhotoMetadataCache.setHash("");
            router.push("/?fresh=1");
        }
    };

    const handleUpload = () => {
        const pending = entries.filter(e => e.status === "pending" || e.status === "error");
        if (pending.length === 0) return;

        // Reset local run stats
        setStats({ done: 0, total: 0, errors: 0, duplicates: 0 });
        void runUpload(pending);
    };

    const retryFile = (id: string) => {
        const entry = entries.find(e => e.id === id);
        if (!entry) return;

        updateStatus(entry.id, "pending", 0, undefined);
        setStats({ done: 0, total: 0, errors: 0, duplicates: 0 });
        void runUpload([{ ...entry, status: "pending", progress: 0, error: undefined }]);
    };

    const updateStatus = (id: string, status: FileEntry["status"], progress: number, error?: string) => {
        setEntries(prev => prev.map(e => e.id === id ? { ...e, status, progress, error } : e));
    };

    const clearEntries = () => {
        setEntries((prev) => {
            for (const entry of prev) {
                if (entry.preview) URL.revokeObjectURL(entry.preview);
            }
            return [];
        });
        setStats({ done: 0, total: 0, errors: 0, duplicates: 0 });
    };

    const actionableCount = entries.filter((entry) => entry.status === "pending" || entry.status === "error").length;
    const globalProgress = stats.total > 0 ? ((stats.done + stats.duplicates) / stats.total) * 100 : 0;

    return (
        <div className="page-shell">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                    <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>Bulk Upload</h1>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Direct-to-B2 with De-duplication</p>
                </div>
                {entries.length > 0 && !uploading && (
                    <button className="btn btn-ghost btn-sm" onClick={clearEntries}>Clear</button>
                )}
            </div>

            {/* B2 Connection Tester */}
            {/* <div style={{
                marginBottom: "1rem", padding: "0.75rem", borderRadius: "var(--r-md)",
                background: b2Status === "ok" ? "rgba(16,185,129,0.1)" : b2Status === "fail" ? "rgba(239,68,68,0.1)" : "var(--bg-subtle)",
                border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {b2Status === "testing" ? <Loader size={16} className="spin" color="var(--accent)" /> :
                        b2Status === "ok" ? <CheckCircle size={16} color="#10B981" /> :
                            b2Status === "fail" ? <AlertTriangle size={16} color="#EF4444" /> :
                                <RefreshCw size={16} color="var(--muted)" />}
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                        {b2Status === "idle" ? "B2 Cloud Storage Status" :
                            b2Status === "testing" ? "Testing Connection..." :
                                b2Status === "ok" ? "Storage Ready!" : "Store Failure (Check CORS)"}
                    </span>
                </div>
                <button
                    className="btn btn-sm"
                    style={{ fontSize: "0.7rem", height: "1.8rem", padding: "0 0.6rem" }}
                    onClick={async (e) => {
                        e.stopPropagation();
                        setB2Status("testing");
                        const res = await testB2Connectivity();
                        if (res.ok) setB2Status("ok");
                        else {
                            setB2Status("fail");
                            setB2Error(res.error || "Unknown Error");
                        }
                    }}
                    disabled={b2Status === "testing"}
                >
                    Test Storage
                </button>
            </div> */}

            {b2Status === "fail" && (
                <div style={{
                    marginBottom: "1rem", padding: "0.75rem", background: "var(--error-soft)",
                    borderRadius: "var(--r-sm)", border: "1px solid rgba(239,68,68,0.2)"
                }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--error)", fontWeight: 700 }}>{b2Error}</p>
                    <div style={{ fontSize: "0.7rem", color: "var(--error)", marginTop: "0.4rem", lineHeight: 1.4 }}>
                        <p style={{ marginBottom: "0.3rem" }}><b>Note:</b> If Status is 0, check B2 CORS or turn off Brave/Browser Shields.</p>
                        <p style={{ marginBottom: "0.3rem" }}><b>Step 1:</b> Add origin: <code>{typeof window !== "undefined" ? window.location.origin : ""}</code></p>
                        <p><b>Step 2:</b> Allow <b>PUT</b> and <b>GET</b> in B2 Dashboard.</p>
                    </div>
                </div>
            )}

            {/* Drop Zone */}
            <div
                className={`panel${dragOver ? " drag-over" : ""}`}
                style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: "1rem", padding: "4rem 2rem",
                    marginBottom: "2rem", border: "2px dashed var(--line)",
                    borderRadius: "var(--r-lg)", transition: "all 0.2s",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
            >
                <div style={{ padding: "1.25rem", borderRadius: "50%", background: "var(--accent-soft)" }}>
                    <Upload size={40} color="var(--accent)" />
                </div>
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: '0.25rem' }}>Upload Photos & ZIPs</p>
                    <p className="desktop-only" style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Drag and drop files here, or use the buttons below</p>
                </div>

                <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                    <button className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                        Select Photos
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '0.75rem 2rem' }} onClick={(e) => {
                        e.stopPropagation();
                        const zipInput = document.createElement('input');
                        zipInput.type = 'file';
                        zipInput.multiple = true;
                        zipInput.accept = '.zip,application/zip';
                        zipInput.onchange = (ev) => {
                            const target = ev.target as HTMLInputElement | null;
                            if (target?.files) addFiles(target.files);
                        };
                        zipInput.click();
                    }}>
                        Select ZIP
                    </button>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "1rem", opacity: 0.8 }}>
                    <span className="mobile-only">On mobile, use &quot;Files&quot; or &quot;Browse&quot; for ZIPs.</span>
                    <span className="desktop-only">Supports high-speed B2 uploads with client-side deduplication.</span>
                </p>

                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                        console.log("[UPLOAD_INPUT] Files selected:", e.target.files?.length);
                        if (e.target.files) addFiles(e.target.files);
                    }}
                />
            </div>

            {/* Global Summary */}
            {entries.length > 0 && (
                <div style={{ marginBottom: "1.25rem", padding: "1rem", borderRadius: "var(--r-md)", background: "var(--bg-subtle)", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                        <span>Overall Status</span>
                        <span>{Math.round(globalProgress)}%</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "rgba(0,0,0,0.05)", borderRadius: 4, overflow: "hidden", marginBottom: "0.75rem" }}>
                        <div style={{ width: `${globalProgress}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", textAlign: "center" }}>
                        <div style={{ background: "var(--bg-card)", padding: "0.4rem", borderRadius: "var(--r-sm)" }}>
                            <p style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Queue</p>
                            <p style={{ fontSize: "0.9rem", fontWeight: 700 }}>{entries.filter(e => e.status === "pending").length}</p>
                        </div>
                        <div style={{ background: "var(--bg-card)", padding: "0.4rem", borderRadius: "var(--r-sm)" }}>
                            <p style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Done</p>
                            <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#10B981" }}>{stats.done}</p>
                        </div>
                        <div style={{ background: "var(--bg-card)", padding: "0.4rem", borderRadius: "var(--r-sm)" }}>
                            <p style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Dupes</p>
                            <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--accent)" }}>{stats.duplicates}</p>
                        </div>
                        <div style={{ background: "var(--bg-card)", padding: "0.4rem", borderRadius: "var(--r-sm)" }}>
                            <p style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Fail</p>
                            <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#EF4444" }}>{stats.errors}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* File List */}
            {entries.length > 0 && (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                    {entries.map((e) => (
                        <div key={e.id} style={{
                            display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.5rem",
                            background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: "var(--r-md)"
                        }}>
                            <div style={{ width: 32, height: 32, borderRadius: 4, overflow: "hidden", background: "var(--bg-subtle)", flexShrink: 0 }}>
                                <img src={e.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                    <p style={{ fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        {e.status === "error" && (
                                            <button onClick={() => retryFile(e.id)} style={{ border: "none", background: "none", color: "var(--accent)", padding: 0 }} title="Retry">
                                                <RefreshCw size={12} />
                                            </button>
                                        )}
                                        <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                                            {e.status === "done" ? <CheckCircle size={12} color="#10B981" /> :
                                                e.status === "duplicate" ? <SkipForward size={12} color="var(--accent)" /> :
                                                    e.status === "error" ? <AlertTriangle size={12} color="#EF4444" /> :
                                                        e.status === "processing" ? "..." :
                                                            `${Math.round(e.progress)}%`}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ width: "100%", height: 3, background: "rgba(0,0,0,0.03)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                                    <div style={{
                                        width: `${e.progress}%`, height: "100%",
                                        background: e.status === "error" ? "#EF4444" :
                                            e.status === "duplicate" ? "var(--muted)" :
                                                e.status === "done" ? "#10B981" : "var(--accent)",
                                        transition: "width 0.1s"
                                    }} />
                                </div>
                                {e.error && <p style={{ fontSize: "0.6rem", color: "#EF4444", marginTop: 2 }}>{e.error}</p>}
                            </div>
                        </div>
                    )).slice(-50)}
                    {entries.length > 50 && <p style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--muted)", padding: "0.5rem" }}>+ {entries.length - 50} more files</p>}
                </div>
            )}

            {!uploading && entries.some(e => e.status === "pending" || e.status === "error") && (
                <div style={{ position: "fixed", bottom: "calc(20px + env(safe-area-inset-bottom))", left: 16, right: 16, zIndex: 100 }}>
                    <button className="btn btn-primary" style={{ width: "100%", height: 50, fontSize: "0.95rem" }} onClick={handleUpload}>
                        {entries.some(e => e.status === "error") ? "Retry Failed Uploads" : `Start Uploading ${actionableCount} Files`}
                    </button>
                </div>
            )}

            {/* Debug Console for User */}
            <details style={{ marginTop: "2rem", opacity: 0.6 }}>
                <summary style={{ fontSize: "0.7rem", color: "var(--muted)", cursor: "pointer" }}>Technical Debug Logs</summary>
                <div style={{
                    maxHeight: "150px", overflowY: "auto", fontSize: "0.65rem", fontFamily: "monospace",
                    padding: "0.5rem", background: "var(--bg-subtle)", borderRadius: "var(--r-sm)", marginTop: "0.5rem"
                }}>
                    {entries.filter(e => e.error).map((e, i) => (
                        <p key={i} style={{ color: "#EF4444", marginBottom: "0.2rem" }}>
                            [{e.name}] Error: {e.error}
                        </p>
                    ))}
                    <p style={{ color: "var(--muted)" }}>Check your terminal (npm run dev) for server-side logs starting with [UPLOAD].</p>
                </div>
            </details>
        </div>
    );
}
