"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Trash2, RotateCcw, Loader, CheckCircle, X, Image,
} from "lucide-react";

type TrashPhoto = {
    id: string;
    thumbUrl: string;
    filename: string;
    sizeBytes: number;
    createdAt: string;
};

export default function TrashPage() {
    const router = useRouter();
    const [photos, setPhotos] = useState<TrashPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [acting, setActing] = useState(false);
    const selectMode = selected.size > 0;

    const fetchTrash = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/photos/trash");
            const data = await res.json();
            setPhotos(data.photos || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTrash(); }, [fetchTrash]);

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleRestore = async () => {
        if (selected.size === 0 || acting) return;
        setActing(true);
        try {
            await fetch("/api/photos/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selected) }),
            });
            setPhotos((prev) => prev.filter((p) => !selected.has(p.id)));
            setSelected(new Set());
        } finally {
            setActing(false);
        }
    };

    const handlePermanentDelete = async () => {
        if (selected.size === 0 || acting) return;
        setActing(true);
        try {
            await fetch("/api/photos/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selected), permanent: true }),
            });
            setPhotos((prev) => prev.filter((p) => !selected.has(p.id)));
            setSelected(new Set());
        } finally {
            setActing(false);
        }
    };

    return (
        <div className="page-shell">
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1rem" }}>
                <button className="btn btn-icon btn-secondary" onClick={() => router.back()}>
                    <ArrowLeft size={18} />
                </button>
                <h1 style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: "1.5rem", fontWeight: 700,
                }}>
                    Trash
                </h1>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: "auto" }}>
                    {photos.length} items
                </span>
            </div>

            {loading && (
                <div className="empty-state" style={{ minHeight: 200 }}>
                    <Loader size={24} className="spin" color="var(--accent)" />
                </div>
            )}

            {!loading && photos.length === 0 && (
                <div className="empty-state" style={{ minHeight: 250 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: "var(--r-lg)",
                        background: "var(--bg-subtle)", display: "flex",
                        alignItems: "center", justifyContent: "center", marginBottom: "0.5rem",
                    }}>
                        <Trash2 size={24} color="var(--muted)" strokeWidth={1.5} />
                    </div>
                    <p className="empty-state-title">Trash is empty</p>
                    <p className="empty-state-sub">Deleted photos will appear here.</p>
                </div>
            )}

            {photos.length > 0 && (
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "3px", borderRadius: "var(--r-sm)", overflow: "hidden",
                }}>
                    {photos.map((photo) => {
                        const isSel = selected.has(photo.id);
                        return (
                            <div key={photo.id} style={{
                                position: "relative", aspectRatio: "1", background: "var(--bg-subtle)",
                                cursor: "pointer", opacity: 0.7,
                            }}
                                onClick={() => toggleSelect(photo.id)}
                            >
                                <img src={photo.thumbUrl} alt={photo.filename} loading="lazy" style={{
                                    width: "100%", height: "100%", objectFit: "cover", display: "block",
                                    opacity: isSel ? 0.5 : 1,
                                }} />
                                {isSel && (
                                    <div style={{
                                        position: "absolute", top: 6, right: 6, width: 24, height: 24,
                                        borderRadius: "50%", background: "var(--accent)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}>
                                        <CheckCircle size={14} color="#fff" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {selectMode && (
                <div style={{
                    position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))",
                    left: 12, right: 12, zIndex: 60,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.65rem 1rem", borderRadius: "var(--r-lg)",
                    background: "var(--bg-elevated)", border: "1px solid var(--line)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}>
                    <button className="btn btn-sm" style={{
                        gap: "0.3rem", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 700,
                    }} onClick={handleRestore} disabled={acting}>
                        <RotateCcw size={14} /> Restore {selected.size}
                    </button>
                    <button className="btn btn-sm" style={{
                        gap: "0.3rem", background: "var(--error)", color: "#fff", border: "none", fontWeight: 700,
                    }} onClick={handlePermanentDelete} disabled={acting}>
                        <Trash2 size={14} /> Delete Forever
                    </button>
                </div>
            )}
        </div>
    );
}
