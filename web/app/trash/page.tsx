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
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
                <button className="btn btn-icon btn-secondary mobile-only" onClick={() => router.back()}>
                    <ArrowLeft size={18} />
                </button>
                <h1 style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 700,
                }}>
                    Trash
                </h1>
                <span style={{ fontSize: "0.95rem", color: "var(--muted)", marginLeft: "auto" }}>
                    {photos.length} items
                </span>
            </div>

            {loading && (
                <div className="empty-state" style={{ minHeight: 300 }}>
                    <Loader size={32} className="spin" color="var(--accent)" />
                </div>
            )}

            {!loading && photos.length === 0 && (
                <div className="empty-state" style={{ minHeight: 350 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: "var(--r-lg)",
                        background: "var(--bg-subtle)", display: "flex",
                        alignItems: "center", justifyContent: "center", marginBottom: "0.75rem",
                    }}>
                        <Trash2 size={32} color="var(--muted)" strokeWidth={1.5} />
                    </div>
                    <p className="empty-state-title" style={{ fontSize: '1.25rem' }}>Trash is empty</p>
                    <p className="empty-state-sub">Deleted photos will appear here.</p>
                </div>
            )}

            {photos.length > 0 && (
                <div className="responsive-grid" style={{ gap: "8px" }}>
                    {photos.map((photo) => {
                        const isSel = selected.has(photo.id);
                        return (
                            <div key={photo.id} style={{
                                position: "relative", aspectRatio: "1", background: "var(--bg-subtle)",
                                cursor: "pointer", borderRadius: 'var(--r-sm)', overflow: 'hidden'
                            }}
                                onClick={() => toggleSelect(photo.id)}
                            >
                                <img src={photo.thumbUrl} alt={photo.filename} loading="lazy" style={{
                                    width: "100%", height: "100%", objectFit: "cover", display: "block",
                                    opacity: isSel ? 0.4 : 0.8,
                                    transition: 'opacity 0.2s'
                                }} />
                                {isSel && (
                                    <div style={{
                                        position: "absolute", top: 10, right: 10, width: 32, height: 32,
                                        borderRadius: "50%", background: "var(--accent)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                                    }}>
                                        <CheckCircle size={20} color="#fff" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {selectMode && (
                <div style={{
                    position: "fixed", bottom: "clamp(20px, 5vh, 40px)",
                    left: "50%", transform: "translateX(-50%)",
                    width: 'auto', minWidth: '320px',
                    zIndex: 100,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: '1rem',
                    padding: "1rem 1.5rem", borderRadius: "var(--r-pill)",
                    background: "var(--bg-elevated)", border: "1px solid var(--line)",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                    backdropFilter: 'blur(10px)'
                }}>
                    <button className="btn" style={{
                        padding: '0.75rem 1.5rem',
                        gap: "0.5rem", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 700,
                        borderRadius: 'var(--r-pill)'
                    }} onClick={handleRestore} disabled={acting}>
                        <RotateCcw size={18} /> Restore {selected.size}
                    </button>
                    <button className="btn" style={{
                        padding: '0.75rem 1.5rem',
                        gap: "0.5rem", background: "var(--error)", color: "#fff", border: "none", fontWeight: 700,
                        borderRadius: 'var(--r-pill)'
                    }} onClick={handlePermanentDelete} disabled={acting}>
                        <Trash2 size={18} /> Delete Forever
                    </button>
                </div>
            )}
        </div>
    );
}
