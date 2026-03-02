"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Upload, Image, Loader, RefreshCw, Trash2, X, Check, Heart, FolderPlus, Plus,
} from "lucide-react";
import { useRealtimePhotos } from "@/lib/useRealtimePhotos";
import { PhotoMetadataCache, type Photo } from "@/lib/photo-cache";
import { CachedImage } from "@/components/CachedImage";

const PAGE_SIZE = 40;

export default function HomePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const filter = (searchParams.get("filter") as "all" | "favorites") || "all";
    const forceFreshLoad = searchParams.get("fresh") === "1";

    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [showAlbumPicker, setShowAlbumPicker] = useState(false);
    const [albums, setAlbums] = useState<{ id: string, name: string }[]>([]);
    const [addingToAlbum, setAddingToAlbum] = useState<string | null>(null);

    const pullStart = useRef(0);
    const [pullOffset, setPullOffset] = useState(0);
    const observerRef = useRef<HTMLDivElement>(null);

    const selectMode = selected.size > 0;

    // Realtime subscription
    useRealtimePhotos({ setPhotos, enabled: !loading });

    const fetchPhotos = useCallback(async (
        offset = 0,
        append = false,
        options?: { forceNetwork?: boolean }
    ) => {
        const forceNetwork = !!options?.forceNetwork;
        if (offset === 0) setLoading(true);
        else setLoadingMore(true);
        setError(null);

        try {
            // 1. Smart Cache Check (Async IndexedDB)
            const localHash = await PhotoMetadataCache.getHash();
            const cached = await PhotoMetadataCache.get(offset);

            if (offset === 0 && forceNetwork) {
                await PhotoMetadataCache.clear();
                await PhotoMetadataCache.setHash("");
            }

            if (offset === 0 && localHash && !refreshing && !forceNetwork) {
                // Check if collection has changed via server-side hash
                const checkRes = await fetch(`/api/photos?hash=${localHash}&limit=${PAGE_SIZE}&offset=0`);
                const data = await checkRes.json();

                if (data.match) {
                    console.log("✅ Cached (Hash matched, skipping DB query)");
                    if (cached) {
                        setPhotos(cached);
                        setHasMore(cached.length === PAGE_SIZE);
                        setLoading(false);
                        return;
                    }
                }
            } else if (offset > 0 && cached && localHash) {
                // For paged scrolls, if we have common hash, we can trust the cache
                console.log(`✅ Cached (Offset ${offset})`);
                setPhotos((prev) => [...prev, ...cached]);
                setHasMore(cached.length === PAGE_SIZE);
                setLoadingMore(false);
                return;
            }

            // 2. Network Fetch (Cache miss or Hash mismatch)
            const hashForRequest = forceNetwork ? "" : (localHash || "");
            const url = `/api/photos?limit=${PAGE_SIZE}&offset=${offset}&hash=${hashForRequest}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch photos");
            const data = await res.json();

            // If we get a new hash, we should ideally clear old cached pages 
            // because the sequence might have changed (new uploads/deletes)
            if (offset === 0 && data.hash && data.hash !== localHash) {
                console.warn("🔄 Hash mismatch, refreshing collection...");
                await PhotoMetadataCache.clear();
                await PhotoMetadataCache.setHash(data.hash);
            }

            const newPhotos: Photo[] = data.photos || [];
            if (append) {
                setPhotos((prev) => [...prev, ...newPhotos]);
            } else {
                setPhotos(newPhotos);
            }

            // 3. Update Cache
            await PhotoMetadataCache.set(offset, newPhotos);
            setHasMore(newPhotos.length === PAGE_SIZE);
        } catch (err) {
            console.error("[Gallery] Fetch error:", err);
            setError(String(err));
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [refreshing]);

    useEffect(() => {
        fetchPhotos(0, false, { forceNetwork: forceFreshLoad });
    }, [fetchPhotos, filter, forceFreshLoad]);

    useEffect(() => {
        if (!forceFreshLoad) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("fresh");
        const next = params.toString();
        router.replace(next ? `/?${next}` : "/", { scroll: false });
    }, [forceFreshLoad, router, searchParams]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F5") { e.preventDefault(); fetchPhotos(0, false); }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [fetchPhotos]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) pullStart.current = e.touches[0].clientY;
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (pullStart.current === 0) return;
        const offset = e.touches[0].clientY - pullStart.current;
        if (offset > 0) {
            setPullOffset(Math.min(offset * 0.4, 80));
            if (offset > 50) e.preventDefault();
        }
    };
    const handleTouchEnd = async () => {
        if (pullOffset > 60) {
            setRefreshing(true);
            setPullOffset(40);
            await fetchPhotos(0, false);
            setRefreshing(false);
        }
        setPullOffset(0);
        pullStart.current = 0;
    };

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

    const toggleGroupSelection = (photoIds: string[]) => {
        setSelected((prev) => {
            const next = new Set(prev);
            const allSelected = photoIds.every(id => next.has(id));
            if (allSelected) {
                photoIds.forEach(id => next.delete(id));
            } else {
                photoIds.forEach(id => next.add(id));
            }
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

    const sortedPhotos = useMemo(() => {
        return [...filteredPhotos].sort((a, b) => {
            const dateA = new Date(a.takenAt || a.createdAt).getTime();
            const dateB = new Date(b.takenAt || b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [filteredPhotos]);

    const groupedPhotos = useMemo(() => {
        const groups: { title: string; photos: Photo[] }[] = [];
        sortedPhotos.forEach((photo) => {
            const date = new Date(photo.takenAt || photo.createdAt);
            const title = formatDateHeader(date);
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.title === title) lastGroup.photos.push(photo);
            else groups.push({ title, photos: [photo] });
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
        <div className="page-shell"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ paddingTop: "1rem" }}
        >
            <div style={{
                height: pullOffset, overflow: "hidden", display: "flex",
                alignItems: "center", justifyContent: "center",
                transition: pullOffset === 0 ? "height 300ms ease" : "none",
                color: "var(--accent)"
            }}>
                {refreshing ? <Loader size={24} className="spin" /> : <RefreshCw size={24} style={{ transform: `rotate(${pullOffset * 4}deg)`, opacity: pullOffset / 80 }} />}
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

            {groupedPhotos.map((group) => (
                <div key={group.title} style={{ marginBottom: "3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", padding: "0 4px" }}>
                        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink-2)" }}>{group.title}</h2>
                        {selectMode && (
                            <button
                                onClick={() => toggleGroupSelection(group.photos.map(p => p.id))}
                                style={{
                                    background: group.photos.every(p => selected.has(p.id)) ? "var(--accent)" : "var(--bg-elevated)",
                                    border: `2px solid ${group.photos.every(p => selected.has(p.id)) ? "var(--bg-elevated)" : "var(--accent)"}`,
                                    cursor: "pointer", color: "var(--bg-elevated)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    width: 28, height: 28, borderRadius: "50%", transition: "all 150ms ease",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                                }}
                            >
                                {group.photos.every(p => selected.has(p.id)) && <Check size={18} strokeWidth={3.5} />}
                            </button>
                        )}
                    </div>
                    <div className="responsive-grid">
                        {group.photos.map((photo) => {
                            const isSelected = selected.has(photo.id);
                            return (
                                <div key={photo.id} className="press-scale" style={{
                                    position: "relative", aspectRatio: "1",
                                    background: "var(--bg-subtle)", cursor: "pointer",
                                    borderRadius: "var(--r-sm)", overflow: "hidden"
                                }}
                                    onClick={() => {
                                        if (selectMode) {
                                            toggleSelect(photo.id);
                                        } else {
                                            // Save context for navigation
                                            sessionStorage.setItem("current_gallery_context", JSON.stringify(sortedPhotos.map(p => p.id)));
                                            router.push(`/photo/${photo.id}`);
                                        }
                                    }}
                                >
                                    <CachedImage
                                        id={photo.id}
                                        src={photo.thumbUrl || photo.url}
                                        alt=""
                                        className="w-full h-full object-cover block transition-opacity duration-150"
                                        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: selectMode ? (isSelected ? 1 : 0.4) : 1 }}
                                        category="thumb"
                                    />
                                    {photo.isLiked && !selectMode && <Heart size={16} fill="var(--accent)" color="var(--accent)" style={{ position: "absolute", bottom: 8, right: 8 }} />}
                                    {
                                        selectMode && (
                                            <div style={{
                                                position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%",
                                                background: isSelected ? "var(--accent)" : "var(--bg-elevated)",
                                                border: `2px solid ${isSelected ? "var(--bg-elevated)" : "var(--accent)"}`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                boxShadow: "0 2px 8px rgba(0,0,0,0.3)", transition: "all 150ms ease"
                                            }}>
                                                {isSelected && <Check size={16} color="var(--bg-elevated)" strokeWidth={4} />}
                                            </div>
                                        )
                                    }
                                </div >
                            );
                        })}
                    </div >
                </div >
            ))}

            <div ref={observerRef} style={{ height: 100 }} />
            {loadingMore && <div style={{ textAlign: "center", padding: "1rem" }}><Loader size={20} className="spin" color="var(--accent)" /></div>}

            {
                selectMode && (
                    <div style={{
                        position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))",
                        left: 12, right: 12, zIndex: 60,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0.65rem 1rem", borderRadius: "var(--r-lg)",
                        background: "var(--bg-elevated)", border: "1px solid var(--line)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{selected.size} selected</div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button className="btn btn-sm" style={{ background: "var(--accent-soft)", color: "var(--accent)", gap: "0.35rem", border: "none", fontWeight: 700 }} onClick={handleOpenAlbumPicker}>
                                <FolderPlus size={14} /> Album
                            </button>
                            <button className="btn btn-sm" style={{ background: "var(--error)", color: "#fff", gap: "0.35rem", border: "none", fontWeight: 700 }} onClick={handleDelete} disabled={deleting}>
                                {deleting ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                                Delete
                            </button>
                        </div>
                    </div>
                )
            }

            {
                showAlbumPicker && (
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
                    </div>
                )
            }
        </div >
    );
}
