"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Upload, Image, Loader, RefreshCw, Trash2, X, CheckCircle, Heart, FolderPlus, Plus,
} from "lucide-react";

type Photo = {
    id: string;
    url: string;
    thumbUrl: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    isLiked: boolean;
    createdAt: string;
};

const PAGE_SIZE = 30;

export default function HomePage() {
    const router = useRouter();
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [filter, setFilter] = useState<"all" | "favorites">("all");
    const [showAlbumPicker, setShowAlbumPicker] = useState(false);
    const [albums, setAlbums] = useState<{ id: string, name: string }[]>([]);
    const [addingToAlbum, setAddingToAlbum] = useState<string | null>(null);
    const observerRef = useRef<HTMLDivElement>(null);

    const selectMode = selected.size > 0;

    const fetchPhotos = useCallback(async (offset = 0, append = false) => {
        if (offset === 0) setLoading(true);
        else setLoadingMore(true);
        setError(null);
        try {
            const url = `/api/photos?limit=${PAGE_SIZE}&offset=${offset}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch photos");
            const data = await res.json();
            const newPhotos: Photo[] = data.photos || [];
            if (append) {
                setPhotos((prev) => [...prev, ...newPhotos]);
            } else {
                setPhotos(newPhotos);
            }
            setHasMore(newPhotos.length === PAGE_SIZE);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

    // Infinite scroll
    useEffect(() => {
        const el = observerRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
                    fetchPhotos(photos.length, true);
                }
            },
            { rootMargin: "200px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, loading, photos.length, fetchPhotos]);

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleDelete = async () => {
        if (selected.size === 0 || deleting) return;
        setDeleting(true);
        try {
            await fetch("/api/photos/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selected) }),
            });
            setPhotos((prev) => prev.filter((p) => !selected.has(p.id)));
            setSelected(new Set());
        } catch (err) {
            console.error(err);
        } finally {
            setDeleting(false);
        }
    };

    const handleOpenAlbumPicker = async () => {
        setShowAlbumPicker(true);
        try {
            const res = await fetch("/api/albums");
            const data = await res.json();
            setAlbums(data.albums || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddToAlbum = async (albumId: string) => {
        if (selected.size === 0 || addingToAlbum) return;
        setAddingToAlbum(albumId);
        try {
            await fetch(`/api/albums/${albumId}/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photoIds: Array.from(selected) }),
            });
            setSelected(new Set());
            setShowAlbumPicker(false);
        } catch (err) {
            console.error(err);
        } finally {
            setAddingToAlbum(null);
        }
    };

    const handleCreateAndAdd = async () => {
        const name = prompt("Enter new album name:");
        if (!name?.trim()) return;

        setAddingToAlbum("new");
        try {
            const res = await fetch("/api/albums", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            const data = await res.json();
            if (data.album?.id) {
                await handleAddToAlbum(data.album.id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAddingToAlbum(null);
        }
    };

    const filteredPhotos = filter === "favorites"
        ? photos.filter((p) => p.isLiked)
        : photos;

    return (
        <div className="page-shell">
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "0.75rem",
            }}>
                <h1 style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: "1.5rem", fontWeight: 700,
                }}>
                    Photos
                </h1>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    {selectMode ? (
                        <>
                            <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600 }}>
                                {selected.size} selected
                            </span>
                            <button className="app-header-btn" onClick={handleDelete}
                                disabled={deleting} style={{ color: "var(--error)" }}>
                                {deleting ? <Loader size={18} className="spin" /> : <Trash2 size={18} />}
                            </button>
                            <button className="app-header-btn" onClick={() => setSelected(new Set())}>
                                <X size={18} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className={`app-header-btn${filter === "favorites" ? " active" : ""}`}
                                onClick={() => setFilter(filter === "all" ? "favorites" : "all")}
                                title="Filter favorites"
                                style={filter === "favorites" ? { color: "#ff4d6a" } : {}}
                            >
                                <Heart size={18} fill={filter === "favorites" ? "#ff4d6a" : "none"}
                                    color={filter === "favorites" ? "#ff4d6a" : undefined} />
                            </button>
                            <button className="app-header-btn" onClick={() => fetchPhotos()}
                                disabled={loading}>
                                <RefreshCw size={18} className={loading ? "spin" : ""} />
                            </button>
                            <button className="btn btn-primary btn-sm"
                                onClick={() => router.push("/upload")} style={{ gap: "0.35rem" }}>
                                <Upload size={14} strokeWidth={2.5} /> Upload
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Loading */}
            {loading && photos.length === 0 && (
                <div className="empty-state" style={{ minHeight: 300 }}>
                    <Loader size={28} className="spin" color="var(--accent)" />
                    <p className="empty-state-sub">Loading photos…</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{
                    padding: "0.75rem 1rem", background: "var(--error-soft)",
                    borderRadius: "var(--r-sm)", color: "var(--error)",
                    fontWeight: 600, fontSize: "0.88rem", marginBottom: "1rem",
                }}>{error}</div>
            )}

            {/* Empty */}
            {!loading && !error && filteredPhotos.length === 0 && (
                <div className="empty-state" style={{ minHeight: 300 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: "var(--r-lg)",
                        background: "var(--accent-soft)", display: "flex",
                        alignItems: "center", justifyContent: "center", marginBottom: "0.5rem",
                    }}>
                        {filter === "favorites" ?
                            <Heart size={28} color="#ff4d6a" strokeWidth={1.5} /> :
                            <Image size={28} color="var(--accent)" strokeWidth={1.5} />
                        }
                    </div>
                    <p className="empty-state-title">
                        {filter === "favorites" ? "No favorites yet" : "No photos yet"}
                    </p>
                    <p className="empty-state-sub">
                        {filter === "favorites"
                            ? "Tap ♥ on photos to mark them as favorites."
                            : "Upload your first photos to get started."}
                    </p>
                    {filter === "all" && (
                        <button className="btn btn-primary" onClick={() => router.push("/upload")}
                            style={{ marginTop: "0.75rem", gap: "0.4rem" }}>
                            <Upload size={16} /> Upload Photos
                        </button>
                    )}
                </div>
            )}

            {/* Photo Grid */}
            {filteredPhotos.length > 0 && (
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "3px", borderRadius: "var(--r-sm)", overflow: "hidden",
                }}>
                    {filteredPhotos.map((photo) => {
                        const isSelected = selected.has(photo.id);
                        return (
                            <div key={photo.id} className="press-scale" style={{
                                position: "relative", aspectRatio: "1",
                                background: "var(--bg-subtle)", cursor: "pointer",
                            }}
                                onClick={() => selectMode ? toggleSelect(photo.id) : router.push(`/photo/${photo.id}`)}
                                onContextMenu={(e) => { e.preventDefault(); toggleSelect(photo.id); }}
                            >
                                <img src={photo.thumbUrl || photo.url} alt={photo.filename}
                                    loading="lazy" style={{
                                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                                        opacity: isSelected ? 0.6 : 1, transition: "opacity 150ms",
                                    }} />
                                {photo.isLiked && !selectMode && (
                                    <Heart size={14} fill="#ff4d6a" color="#ff4d6a" style={{
                                        position: "absolute", bottom: 4, right: 4,
                                        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                                    }} />
                                )}
                                {isSelected && (
                                    <div style={{
                                        position: "absolute", top: 6, right: 6, width: 24, height: 24,
                                        borderRadius: "50%", background: "var(--accent)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                                    }}>
                                        <CheckCircle size={14} color="#fff" strokeWidth={3} />
                                    </div>
                                )}
                                {selectMode && !isSelected && (
                                    <div style={{
                                        position: "absolute", top: 6, right: 6, width: 24, height: 24,
                                        borderRadius: "50%", border: "2px solid rgba(255,255,255,0.7)",
                                        background: "rgba(0,0,0,0.2)",
                                    }} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={observerRef} style={{ height: 1 }} />
            {loadingMore && (
                <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                    <Loader size={20} className="spin" color="var(--accent)" />
                </div>
            )}

            {/* Select action bar */}
            {selectMode && (
                <div style={{
                    position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))",
                    left: 12, right: 12, zIndex: 60,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.65rem 1rem", borderRadius: "var(--r-lg)",
                    background: "var(--bg-elevated)", border: "1px solid var(--line)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}>
                    <button className="btn btn-ghost btn-sm"
                        onClick={() => {
                            selected.size === filteredPhotos.length
                                ? setSelected(new Set())
                                : setSelected(new Set(filteredPhotos.map((p) => p.id)));
                        }}>
                        {selected.size === filteredPhotos.length ? "Deselect All" : "Select All"}
                    </button>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-sm" style={{
                            background: "var(--accent-soft)", color: "var(--accent)", gap: "0.35rem", border: "none", fontWeight: 700,
                        }} onClick={handleOpenAlbumPicker}>
                            <FolderPlus size={14} /> Album
                        </button>
                        <button className="btn btn-sm" style={{
                            background: "var(--error)", color: "#fff", gap: "0.35rem", border: "none", fontWeight: 700,
                        }} onClick={handleDelete} disabled={deleting}>
                            {deleting ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                            Delete {selected.size}
                        </button>
                    </div>
                </div>
            )}

            {/* Album Picker Modal */}
            {showAlbumPicker && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 100,
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "flex-end",
                }}>
                    <div style={{ position: "absolute", inset: 0 }} onClick={() => setShowAlbumPicker(false)} />
                    <div style={{
                        position: "relative", width: "100%", background: "var(--bg-elevated)",
                        borderRadius: "1.25rem 1.25rem 0 0", padding: "1.25rem",
                        paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
                        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
                        animation: "slide-up 250ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Add to collection</h3>
                            <button onClick={() => setShowAlbumPicker(false)} style={{ border: "none", background: "none", color: "var(--muted)" }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ maxHeight: "50vh", overflowY: "auto", display: "grid", gap: "0.5rem" }}>
                            <button className="album-picker-item" onClick={handleCreateAndAdd} style={{ color: "var(--accent)" }}>
                                <Plus size={18} /> <span>New Album</span>
                            </button>
                            {albums.map((a) => (
                                <button key={a.id} className="album-picker-item" onClick={() => handleAddToAlbum(a.id)}
                                    disabled={!!addingToAlbum}>
                                    {addingToAlbum === a.id ? <Loader size={18} className="spin" /> : <Image size={18} color="var(--muted)" />}
                                    <span>{a.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <style jsx>{`
                        .album-picker-item {
                            display: flex;
                            align-items: center;
                            gap: 0.75rem;
                            width: 100%;
                            padding: 1rem;
                            border: 1px solid var(--line);
                            background: var(--bg-card);
                            border-radius: var(--r-md);
                            font-size: 0.95rem;
                            font-weight: 600;
                            cursor: pointer;
                            text-align: left;
                        }
                        .album-picker-item:hover {
                            border-color: var(--accent);
                        }
                        @keyframes slide-up {
                            from { transform: translateY(100%); }
                            to { transform: translateY(0); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
