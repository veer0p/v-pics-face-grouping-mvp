"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Upload, X, CheckCircle, AlertTriangle, Loader,
} from "lucide-react";

type FileEntry = {
    file: File;
    preview: string;
    status: "pending" | "uploading" | "done" | "error";
    error?: string;
};

export default function UploadPage() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const entries: FileEntry[] = Array.from(newFiles)
            .filter((f) => f.type.startsWith("image/"))
            .map((f) => ({
                file: f,
                preview: URL.createObjectURL(f),
                status: "pending" as const,
            }));
        setFiles((prev) => [...prev, ...entries]);
    }, []);

    const removeFile = (index: number) => {
        setFiles((prev) => {
            URL.revokeObjectURL(prev[index].preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
        },
        [addFiles],
    );

    const handleUpload = async () => {
        if (files.length === 0 || uploading) return;
        setUploading(true);

        // Mark all as uploading
        setFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" as const })));

        try {
            // Build FormData with all files
            const formData = new FormData();
            for (const entry of files) {
                formData.append("files", entry.file);
            }

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Upload failed (${res.status})`);
            }

            // Mark all as done
            setFiles((prev) => prev.map((f) => ({ ...f, status: "done" as const })));

            // Navigate home after short delay
            setTimeout(() => router.push("/"), 1200);
        } catch (err) {
            console.error("Upload error:", err);
            setFiles((prev) =>
                prev.map((f) =>
                    f.status === "uploading"
                        ? { ...f, status: "error" as const, error: String(err) }
                        : f,
                ),
            );
        } finally {
            setUploading(false);
        }
    };

    const pendingCount = files.filter((f) => f.status === "pending").length;

    return (
        <div className="page-shell">
            <h1 style={{
                fontFamily: "var(--font-display)", fontStyle: "italic",
                fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.25rem",
            }}>
                Upload Photos
            </h1>

            {/* Drop Zone */}
            <div
                className={`panel press-scale${dragOver ? " drag-over" : ""}`}
                style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: "0.75rem", padding: "2.5rem 1.5rem",
                    marginBottom: "1.25rem", cursor: "pointer",
                    border: dragOver ? "2px dashed var(--accent)" : "1px solid var(--line)",
                    background: dragOver ? "var(--accent-soft)" : "var(--bg-elevated)",
                    transition: "all 200ms ease",
                }}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                <Upload size={32} strokeWidth={1.5} color="var(--accent)" />
                <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    Tap to select or drag photos here
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    JPEG, PNG, HEIC • Max 50 photos per batch
                </p>
                <input
                    ref={inputRef} type="file" accept="image/*" multiple
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
            </div>

            {/* Preview Grid */}
            {files.length > 0 && (
                <>
                    <div style={{
                        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "0.5rem", marginBottom: "1.25rem",
                    }}>
                        {files.map((entry, i) => (
                            <div key={i} style={{
                                position: "relative", aspectRatio: "1",
                                borderRadius: "var(--r-sm)", overflow: "hidden",
                                background: "var(--bg-subtle)",
                            }}>
                                <img src={entry.preview} alt={entry.file.name} style={{
                                    width: "100%", height: "100%", objectFit: "cover",
                                    opacity: entry.status === "done" ? 0.6 : 1,
                                }} />
                                {entry.status === "uploading" && (
                                    <div style={{
                                        position: "absolute", inset: 0, display: "flex",
                                        alignItems: "center", justifyContent: "center",
                                        background: "rgba(0,0,0,0.4)",
                                    }}>
                                        <Loader size={20} color="#fff" className="spin" />
                                    </div>
                                )}
                                {entry.status === "done" && (
                                    <div style={{
                                        position: "absolute", inset: 0, display: "flex",
                                        alignItems: "center", justifyContent: "center",
                                        background: "rgba(0,0,0,0.3)",
                                    }}>
                                        <CheckCircle size={24} color="#4ade80" strokeWidth={2.5} />
                                    </div>
                                )}
                                {entry.status === "error" && (
                                    <div style={{
                                        position: "absolute", inset: 0, display: "flex",
                                        flexDirection: "column", alignItems: "center",
                                        justifyContent: "center", background: "rgba(0,0,0,0.5)",
                                        padding: "0.5rem",
                                    }}>
                                        <AlertTriangle size={20} color="#f87171" strokeWidth={2.5} />
                                        <p style={{ color: "#f87171", fontSize: "0.65rem", marginTop: 4, textAlign: "center" }}>
                                            {entry.error || "Failed"}
                                        </p>
                                    </div>
                                )}
                                {entry.status === "pending" && (
                                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} style={{
                                        position: "absolute", top: 4, right: 4, width: 22, height: 22,
                                        borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none",
                                        color: "#fff", display: "flex", alignItems: "center",
                                        justifyContent: "center", cursor: "pointer", padding: 0, minHeight: "unset",
                                    }}>
                                        <X size={12} strokeWidth={3} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        className="btn btn-primary"
                        style={{ width: "100%", gap: "0.5rem" }}
                        onClick={handleUpload}
                        disabled={uploading || files.every((f) => f.status === "done")}
                    >
                        {uploading ? (
                            <><Loader size={16} className="spin" /> Uploading…</>
                        ) : files.every((f) => f.status === "done") ? (
                            <><CheckCircle size={16} /> All uploaded! Redirecting…</>
                        ) : (
                            <><Upload size={16} /> Upload {pendingCount} {pendingCount === 1 ? "Photo" : "Photos"}</>
                        )}
                    </button>
                </>
            )}
        </div>
    );
}
