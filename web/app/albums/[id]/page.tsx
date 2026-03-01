"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, MoreVertical, Plus, Image as ImageIcon,
    Loader, Trash2, Edit3, X, CheckCircle, Search
} from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";

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
    const [showPhotoPicker, setShowPhotoPicker] = useState(false);

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
                display: "flex", alignItems: "center", gap: "1rem",
                padding: "1.5rem 2rem", borderBottom: '1px solid var(--line)'
            }}>
                <button className="btn btn-icon btn-secondary mobile-only" onClick={() => router.push("/albums")} aria-label="Back">
                    <ArrowLeft size={18} strokeWidth={2} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 style={{ fontWeight: 700, fontSize: "clamp(1.2rem, 3vw, 1.75rem)", fontFamily: "var(--font-display)", fontStyle: "italic" }}>
                        {album.name}
                    </h1>
                    <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginTop: '0.2rem' }}>
                        {photos.length} {photos.length === 1 ? "photo" : "photos"}
                    </p>
                </div>
                <div style={{ position: "relative" }}>
                    <button className="btn btn-icon btn-secondary" onClick={() => setShowMenu(!showMenu)}>
                        <MoreVertical size={20} strokeWidth={2} />
                    </button>
                    {showMenu && (
                        <>
                            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
                            <div className="dropdown-menu" style={{ top: "100%", right: 0 }}>
                                <button className="menu-item" onClick={() => { setShowMenu(false); handleRename(); }}>
                                    <Edit3 size={16} /> Rename
                                </button>
                                <button className="menu-item" style={{ color: "var(--error)" }}
                                    onClick={() => { setShowMenu(false); handleDeleteAlbum(); }}>
                                    {deleting ? <Loader size={16} className="spin" /> : <Trash2 size={16} />}
                                    Delete Album
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Photo grid */}
            <div style={{ padding: '1rem 2rem' }}>
                {photos.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 400 }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: "var(--r-lg)",
                            background: "var(--bg-subtle)", display: "flex",
                            alignItems: "center", justifyContent: "center", marginBottom: "1rem",
                        }}>
                            <ImageIcon size={32} color="var(--muted)" strokeWidth={1.5} />
                        </div>
                        <p className="empty-state-title" style={{ fontSize: '1.25rem' }}>Album is empty</p>
                        <p className="empty-state-sub">Add photos to this collection to see them here.</p>
                    </div>
                ) : (
                    <div className="responsive-grid" style={{ gap: "8px" }}>
                        {photos.map((p) => (
                            <div key={p.id} className="press-scale" style={{
                                aspectRatio: "1", background: "var(--bg-subtle)", position: "relative",
                                borderRadius: 'var(--r-sm)', overflow: 'hidden'
                            }} onClick={() => router.push(`/photo/${p.id}`)}>
                                <img src={p.thumbUrl} alt={p.filename} style={{
                                    width: "100%", height: "100%", objectFit: "cover",
                                }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Add button */}
            <div style={{
                position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))",
                left: "50%", transform: "translateX(-50%)", zIndex: 30,
            }}>
                <button className="btn btn-primary" style={{
                    borderRadius: "var(--r-pill)", padding: "0.65rem 1.25rem",
                    boxShadow: "0 8px 24px rgba(91,78,255,0.35)",
                    display: "flex", alignItems: "center", gap: "0.4rem",
                }} onClick={() => setShowPhotoPicker(true)}>
                    <Plus size={16} strokeWidth={2.5} /> Add Photos
                </button>
            </div>

            <BottomSheet open={showPhotoPicker} onClose={() => setShowPhotoPicker(false)} title="Select from library">
                <PhotoPicker
                    albumId={id}
                    onClose={() => setShowPhotoPicker(false)}
                    onAdded={() => {
                        setShowPhotoPicker(false);
                        fetchDetail();
                    }}
                />
            </BottomSheet>

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

function PhotoPicker({ albumId, onAdded, onClose }: { albumId: string, onAdded: () => void, onClose: () => void }) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchLibrary() {
            try {
                const res = await fetch('/api/photos?limit=100');
                const data = await res.json();
                setPhotos(data.photos || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchLibrary();
    }, []);

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleAdd = async () => {
        if (selected.size === 0 || saving) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/albums/${albumId}/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photoIds: Array.from(selected) }),
            });
            if (res.ok) onAdded();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                        <Loader size={24} className="spin" color="var(--accent)" />
                    </div>
                ) : (
                    <div className="responsive-grid" style={{ gap: "4px" }}>
                        {photos.map((p) => {
                            const isSelected = selected.has(p.id);
                            return (
                                <div key={p.id} className="press-scale" style={{
                                    aspectRatio: "1", background: "var(--bg-subtle)", position: "relative",
                                    borderRadius: 'var(--r-sm)', overflow: 'hidden', cursor: "pointer"
                                }} onClick={() => toggleSelect(p.id)}>
                                    <img src={p.thumbUrl} alt="" style={{
                                        width: "100%", height: "100%", objectFit: "cover",
                                        opacity: isSelected ? 0.6 : 1, transition: "opacity 150ms"
                                    }} />
                                    {isSelected && (
                                        <div style={{
                                            position: "absolute", top: 8, right: 8, width: 20, height: 20,
                                            borderRadius: "50%", background: "var(--accent)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                                        }}>
                                            <CheckCircle size={14} color="#fff" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div style={{
                padding: "1rem", borderTop: "1px solid var(--line)",
                display: "flex", gap: "1rem", background: "var(--bg-elevated)"
            }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }}
                    onClick={handleAdd} disabled={selected.size === 0 || saving}>
                    {saving ? <Loader size={18} className="spin" /> : `Add ${selected.size} Photos`}
                </button>
            </div>
        </div>
    );
}
