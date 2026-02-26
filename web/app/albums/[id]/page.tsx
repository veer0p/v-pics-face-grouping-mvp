"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, MoreVertical, Plus, Image as ImageIcon,
    Loader, Trash2, Edit3, X, CheckCircle
} from "lucide-react";

type Album = {
    id: string;
    name: string;
    createdAt: string;
};

type Photo = {
    id: string;
    url: string;
    thumbUrl: string;
    filename: string;
    width: number | null;
    height: number | null;
    isLiked: boolean;
};

export default function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [album, setAlbum] = useState<Album | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/albums/${id}`);
            if (!res.ok) throw new Error("Not found");
            const data = await res.json();
            setAlbum(data.album);
            setPhotos(data.photos || []);
        } catch (err) {
            console.error(err);
            router.push("/albums");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDetail(); }, [id]);

    const handleDeleteAlbum = async () => {
        if (!confirm("Are you sure you want to delete this album? Photos will not be deleted.")) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
            if (res.ok) router.push("/albums");
        } catch (err) {
            console.error(err);
        } finally {
            setDeleting(false);
        }
    };

    const handleRename = async () => {
        if (!album) return;
        const newName = prompt("Rename album:", album.name);
        if (!newName || newName === album.name) return;

        try {
            const res = await fetch(`/api/albums/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setAlbum(data.album);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="page-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <Loader size={28} className="spin" color="var(--accent)" />
            </div>
        );
    }

    if (!album) return null;

    return (
        <div className="page-shell" style={{ padding: 0 }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", gap: "0.65rem",
                padding: "0.75rem 1rem", paddingTop: "max(0.75rem, env(safe-area-inset-top))",
            }}>
                <button className="btn btn-icon btn-secondary" onClick={() => router.push("/albums")} aria-label="Back">
                    <ArrowLeft size={18} strokeWidth={2} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: "1rem", fontFamily: "var(--font-display)", fontStyle: "italic" }}>
                        {album.name}
                    </p>
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        {photos.length} {photos.length === 1 ? "photo" : "photos"}
                    </p>
                </div>
                <div style={{ position: "relative" }}>
                    <button className="btn btn-icon btn-secondary" onClick={() => setShowMenu(!showMenu)}>
                        <MoreVertical size={18} strokeWidth={2} />
                    </button>
                    {showMenu && (
                        <>
                            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
                            <div style={{
                                position: "absolute", top: "100%", right: 0, zIndex: 50,
                                background: "var(--bg-elevated)", border: "1px solid var(--line)",
                                borderRadius: "var(--r-md)", padding: "0.4rem", minWidth: "140px",
                                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                                animation: "fade-in 150ms ease",
                            }}>
                                <button className="menu-item" onClick={() => { setShowMenu(false); handleRename(); }}>
                                    <Edit3 size={14} /> Rename
                                </button>
                                <button className="menu-item" style={{ color: "var(--error)" }}
                                    onClick={() => { setShowMenu(false); handleDeleteAlbum(); }}>
                                    {deleting ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                                    Delete Album
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Photo grid */}
            {photos.length === 0 ? (
                <div className="empty-state" style={{ minHeight: 300 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: "var(--r-lg)",
                        background: "var(--bg-subtle)", display: "flex",
                        alignItems: "center", justifyContent: "center", marginBottom: "0.5rem",
                    }}>
                        <ImageIcon size={24} color="var(--muted)" strokeWidth={1.5} />
                    </div>
                    <p className="empty-state-title">Album is empty</p>
                    <p className="empty-state-sub">Add photos to this collection to see them here.</p>
                </div>
            ) : (
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px",
                    padding: "0.15rem",
                }}>
                    {photos.map((p) => (
                        <div key={p.id} className="press-scale" style={{
                            aspectRatio: "1", background: "var(--bg-subtle)", position: "relative"
                        }} onClick={() => router.push(`/photo/${p.id}`)}>
                            <img src={p.thumbUrl} alt={p.filename} style={{
                                width: "100%", height: "100%", objectFit: "cover",
                            }} />
                        </div>
                    ))}
                </div>
            )}

            {/* Floating Add button */}
            <div style={{
                position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))",
                left: "50%", transform: "translateX(-50%)", zIndex: 30,
            }}>
                <button className="btn btn-primary" style={{
                    borderRadius: "var(--r-pill)", padding: "0.65rem 1.25rem",
                    boxShadow: "0 8px 24px rgba(91,78,255,0.35)",
                    display: "flex", alignItems: "center", gap: "0.4rem",
                }} onClick={() => router.push("/")}>
                    <Plus size={16} strokeWidth={2.5} /> Add Photos
                </button>
            </div>

            <style jsx>{`
                .menu-item {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    width: 100%;
                    padding: 0.65rem 0.75rem;
                    border: none;
                    background: none;
                    color: var(--ink-1);
                    font-size: 0.82rem;
                    font-weight: 500;
                    border-radius: var(--r-sm);
                    cursor: pointer;
                    text-align: left;
                }
                .menu-item:hover {
                    background: var(--bg-subtle);
                }
            `}</style>
        </div>
    );
}
