"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Upload, Image, Loader, RefreshCw, Trash2, X, CheckCircle, Heart, FolderPlus, Plus,
} from "lucide-react";
import { useRealtimePhotos } from "@/lib/useRealtimePhotos";

type Photo = {
    id: string;
    url: string;
    thumbUrl: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    isLiked: boolean;
    takenAt: string | null;
    createdAt: string;
};

const PAGE_SIZE = 40;

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

    // Realtime subscription — new photos from other devices appear instantly
    useRealtimePhotos({ photos, setPhotos, enabled: !loading });

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
        if (!confirm(`Are you sure you want to delete ${selected.size} photo(s)?`)) return;
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

    const filteredPhotos = useMemo(() => {
        return filter === "favorites" ? photos.filter((p) => p.isLiked) : photos;
    }, [photos, filter]);

    // Chronological Sort (Perfect interleaving)
    const sortedPhotos = useMemo(() => {
        return [...filteredPhotos].sort((a, b) => {
            const dateA = new Date(a.takenAt || a.createdAt).getTime();
            const dateB = new Date(b.takenAt || b.createdAt).getTime();
            return dateB - dateA; // Latest first
        });
    }, [filteredPhotos]);

    // Grouping Logic
    const groupedPhotos = useMemo(() => {
        const groups: { title: string; photos: Photo[] }[] = [];
        sortedPhotos.forEach((photo) => {
            const date = new Date(photo.takenAt || photo.createdAt);
            const title = formatDateHeader(date);
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.title === title) {
                lastGroup.photos.push(photo);
            } else {
                groups.push({ title, photos: [photo] });
            }
        });
        return groups;
    }, [sortedPhotos]);

    function formatDateHeader(date: Date) {
        const now = new Date();
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        if (date.toDateString() === now.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined };
        return date.toLocaleDateString(undefined, options);
    }

    return (
        <div className="page-shell">
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "2rem", position: "sticky", top: 0, zIndex: 40,
                background: "var(--bg)", padding: "1rem 0",
            }}>
                <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.75rem", fontWeight: 700 }}>
                    Photos
                </h1>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {selectMode ? (
                        <>
                            <span className="desktop-only" style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 600 }}>{selected.size} items selected</span>
                            <button className="app-header-btn" onClick={handleDelete} disabled={deleting} style={{ color: "var(--error)" }}>
                                {deleting ? <Loader size={20} className="spin" /> : <Trash2 size={20} />}
                            </button>
                            <button className="app-header-btn" onClick={() => setSelected(new Set())}><X size={20} /></button>
                        </>
                    ) : (
                        <>
                            <button className={`app-header-btn${filter === "favorites" ? " active" : ""}`}
                                onClick={() => setFilter(filter === "all" ? "favorites" : "all")}
                                style={filter === "favorites" ? { color: "#ff4d6a" } : {}}>
                                <Heart size={20} fill={filter === "favorites" ? "#ff4d6a" : "none"} color={filter === "favorites" ? "#ff4d6a" : undefined} />
                            </button>
                            <button className="app-header-btn" onClick={() => fetchPhotos()} disabled={loading}>
                                <RefreshCw size={20} className={loading ? "spin" : ""} />
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => router.push("/upload")} style={{ gap: "0.5rem", padding: "0.5rem 1.25rem" }}>
                                <Upload size={16} strokeWidth={2.5} /> <span className="desktop-only">Upload Photos</span><span className="mobile-only">Upload</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {loading && photos.length === 0 && (
                <div className="empty-state" style={{ minHeight: "50vh" }}>
                    <Loader size={32} className="spin" color="var(--accent)" />
                </div>
            )}

            {error && (
                <div style={{ padding: "1rem", background: "var(--error-soft)", borderRadius: "var(--r-md)", color: "var(--error)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "1.5rem", border: "1px solid var(--error)" }}>{error}</div>
            )}

            {!loading && !error && filteredPhotos.length === 0 && (
                <div className="empty-state" style={{ minHeight: "50vh" }}>
                    <p className="empty-state-title" style={{ fontSize: '1.25rem' }}>{filter === "favorites" ? "No favorites yet" : "No photos yet"}</p>
                    <button className="btn btn-primary" onClick={() => router.push("/upload")} style={{ marginTop: "1.5rem" }}>Upload Photos</button>
                </div>
            )}

            {/* Chronological Grid */}
            {groupedPhotos.map((group) => (
                <div key={group.title} style={{ marginBottom: "3rem" }}>
                    <h2 style={{
                        fontSize: "1rem", fontWeight: 700, color: "var(--ink-2)",
                        marginBottom: "1rem", paddingLeft: "4px",
                    }}>
                        {group.title}
                    </h2>
                    <div className="responsive-grid">
                        {group.photos.map((photo) => {
                            const isSelected = selected.has(photo.id);
                            return (
                                <div key={photo.id} className="press-scale" style={{
                                    position: "relative", aspectRatio: "1",
                                    background: "var(--bg-subtle)", cursor: "pointer",
                                    borderRadius: "var(--r-sm)", overflow: "hidden"
                                }}
                                    onClick={() => selectMode ? toggleSelect(photo.id) : router.push(`/photo/${photo.id}`)}
                                    onContextMenu={(e) => { e.preventDefault(); toggleSelect(photo.id); }}
                                >
                                    <img src={photo.thumbUrl || photo.url} alt="" loading="lazy" style={{
                                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                                        opacity: isSelected ? 0.6 : 1, transition: "opacity 150ms",
                                    }} />
                                    {photo.isLiked && !selectMode && (
                                        <Heart size={16} fill="#ff4d6a" color="#ff4d6a" style={{ position: "absolute", bottom: 8, right: 8 }} />
                                    )}
                                    {isSelected && (
                                        <div style={{
                                            position: "absolute", top: 8, right: 8, width: 24, height: 24,
                                            borderRadius: "50%", background: "var(--accent)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                                        }}>
                                            <CheckCircle size={16} color="#fff" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div ref={observerRef} style={{ height: 100 }} />
            {loadingMore && <div style={{ textAlign: "center", padding: "1rem" }}><Loader size={20} className="spin" color="var(--accent)" /></div>}

            {/* Select action bar (same as before) */}
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
                        <button className="btn btn-sm" style={{ background: "var(--accent-soft)", color: "var(--accent)", gap: "0.35rem", border: "none", fontWeight: 700 }} onClick={handleOpenAlbumPicker}>
                            <FolderPlus size={14} /> Album
                        </button>
                        <button className="btn btn-sm" style={{ background: "var(--error)", color: "#fff", gap: "0.35rem", border: "none", fontWeight: 700 }} onClick={handleDelete} disabled={deleting}>
                            {deleting ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                            Delete {selected.size}
                        </button>
                    </div>
                </div>
            )}

            {/* Album Picker Modal (same as before) */}
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
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Add to collection</h3>
                            <button onClick={() => setShowAlbumPicker(false)} style={{ border: "none", background: "none", color: "var(--muted)" }}><X size={20} /></button>
                        </div>
                        <div style={{ maxHeight: "40vh", overflowY: "auto", display: "grid", gap: "0.5rem" }}>
                            <button className="album-picker-item" onClick={handleCreateAndAdd} style={{ color: "var(--accent)" }}><Plus size={18} /> <span>New Album</span></button>
                            {albums.map((a) => (
                                <button key={a.id} className="album-picker-item" onClick={() => handleAddToAlbum(a.id)} disabled={!!addingToAlbum}>
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
                    `}</style>
                </div>
            )}
        </div>
    );
}
