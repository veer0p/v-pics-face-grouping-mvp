"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    FolderPlus, Loader, RefreshCw, Trash2, X, Check, Heart, CloudCheck, Play,
} from "lucide-react";
import { PhotoMetadataCache, type Photo } from "@/lib/photo-cache";
import { CachedImage } from "@/components/CachedImage";
import { useUploadQueue, type PendingUploadItem } from "@/components/UploadQueueProvider";
import { useNetwork } from "@/components/NetworkContext";
import { PageHeader } from "@/components/PageHeader";
import { useHeaderSyncAction } from "@/components/HeaderSyncContext";
import { safeSessionStorageSet } from "@/lib/browser-storage";

const PAGE_SIZE = 40;
const POST_UPLOAD_REFRESH_DELAY_MS = 1200;

let homeFeedSnapshot: { photos: Photo[]; hasMore: boolean } | null = null;

type LocalGalleryPhoto = {
    kind: "local";
    id: string;
    localId: string;
    url: string;
    thumbUrl: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    isLiked: false;
    takenAt: string | null;
    durationMs: number | null;
    mediaType: "image" | "video";
    createdAt: string;
    status: PendingUploadItem["status"];
    progress: number;
    error: string | null;
    attempts: number;
    contentHash: string | null;
};

type ServerGalleryPhoto = Photo & { kind: "server" };
type GalleryPhoto = ServerGalleryPhoto | LocalGalleryPhoto;

type AlbumPickerItem = {
    id: string;
    name: string;
    count: number;
};

function mediaTypeOf(photo: { mediaType?: string; mimeType?: string }) {
    if (photo.mediaType === "video") return "video";
    if (String(photo.mimeType || "").startsWith("video/")) return "video";
    return "image";
}

function formatDuration(durationMs: number | null | undefined) {
    if (!durationMs || durationMs <= 0) return "0:00";
    const totalSec = Math.floor(durationMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${mins}:${String(sec).padStart(2, "0")}`;
}

export default function HomePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { pendingItems, reconcileWithServerPhotos } = useUploadQueue();
    const { isOnline } = useNetwork();
    const filter = (searchParams.get("filter") as "all" | "favorites") || "all";
    const forceFreshLoad = searchParams.get("fresh") === "1";

    const [photos, setPhotos] = useState<Photo[]>(() => homeFeedSnapshot?.photos ?? []);
    const [loading, setLoading] = useState(() => !(homeFeedSnapshot?.photos.length));
    const [loadingMore, setLoadingMore] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [hasMore, setHasMore] = useState(() => homeFeedSnapshot?.hasMore ?? true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [albumPickerOpen, setAlbumPickerOpen] = useState(false);
    const [albumPickerLoading, setAlbumPickerLoading] = useState(false);
    const [addingToAlbum, setAddingToAlbum] = useState(false);
    const [albums, setAlbums] = useState<AlbumPickerItem[]>([]);

    const pullStart = useRef(0);
    const [pullOffset, setPullOffset] = useState(0);
    const observerRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTriggered = useRef(false);
    const photoCountRef = useRef(homeFeedSnapshot?.photos.length ?? 0);

    const selectMode = selected.size > 0;

    const applyPhotoPage = useCallback((nextPhotos: Photo[], append: boolean) => {
        if (append) {
            setPhotos((prev) => [...prev, ...nextPhotos]);
        } else {
            setPhotos(nextPhotos);
        }
        setHasMore(nextPhotos.length === PAGE_SIZE);
    }, []);

    const tryLoadCachedPage = useCallback(async (
        offset: number,
        append: boolean,
        fallbackMessage?: string | null,
    ) => {
        const cached = await PhotoMetadataCache.get(offset);
        if (!cached) return false;

        applyPhotoPage(cached, append);
        setError(fallbackMessage ?? null);
        return true;
    }, [applyPhotoPage]);

    const clearLongPress = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    const startLongPress = useCallback((photoId: string) => {
        clearLongPress();
        longPressTriggered.current = false;
        longPressTimer.current = setTimeout(() => {
            longPressTriggered.current = true;
            // Haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(30);
            setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(photoId)) next.delete(photoId);
                else next.add(photoId);
                return next;
            });
        }, 500);
    }, [clearLongPress]);

    const cancelLongPress = useCallback(() => {
        clearLongPress();
    }, [clearLongPress]);

    const fetchPhotos = useCallback(async (
        offset = 0,
        append = false,
        options?: { forceNetwork?: boolean; silent?: boolean }
    ) => {
        const forceNetwork = !!options?.forceNetwork;
        const silent = !!options?.silent;
        if (offset === 0) {
            if (!silent && photoCountRef.current === 0) setLoading(true);
        }
        else setLoadingMore(true);
        setError(null);

        try {
            if (!navigator.onLine && !forceNetwork) {
                const restored = await tryLoadCachedPage(
                    offset,
                    append,
                    "You are offline. Showing cached photos.",
                );
                if (restored) return;
                throw new Error("You are offline and no cached photos are available.");
            }

            const res = await fetch(`/api/photos?limit=${PAGE_SIZE}&offset=${offset}`, {
                cache: "no-store",
            });
            if (!res.ok) throw new Error("Failed to fetch photos");
            const data = await res.json();

            const newPhotos: Photo[] = data.photos || [];
            applyPhotoPage(newPhotos, append);

            void (async () => {
                if (offset === 0) {
                    if (forceNetwork) {
                        await PhotoMetadataCache.clear();
                    }
                    if (typeof data.hash === "string" && data.hash) {
                        await PhotoMetadataCache.setHash(data.hash);
                    }
                }
                await PhotoMetadataCache.set(offset, newPhotos);
            })();
        } catch (err) {
            const restored = await tryLoadCachedPage(
                offset,
                append,
                navigator.onLine ? "Live refresh failed. Showing cached photos." : "You are offline. Showing cached photos.",
            );
            if (!restored) {
                console.error("[Gallery] Fetch error:", err);
                setError(err instanceof Error ? err.message : "Failed to fetch photos");
            }
        } finally {
            if (!silent || offset !== 0) {
                setLoading(false);
            }
            setLoadingMore(false);
        }
    }, [applyPhotoPage, tryLoadCachedPage]);

    const syncLatest = useCallback(async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            await fetchPhotos(0, false, { forceNetwork: true, silent: photos.length > 0 });
        } finally {
            setSyncing(false);
        }
    }, [fetchPhotos, photos.length, syncing]);

    useEffect(() => {
        photoCountRef.current = photos.length;
    }, [photos.length]);

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            if (homeFeedSnapshot?.photos.length) {
                applyPhotoPage(homeFeedSnapshot.photos, false);
                setLoading(false);
                void fetchPhotos(0, false, { forceNetwork: forceFreshLoad, silent: true });
                return;
            }

            const cached = forceFreshLoad ? null : await PhotoMetadataCache.get(0).catch(() => null);
            if (cancelled) return;

            if (cached?.length) {
                applyPhotoPage(cached, false);
                setLoading(false);
                void fetchPhotos(0, false, { forceNetwork: forceFreshLoad, silent: true });
                return;
            }

            void fetchPhotos(0, false, { forceNetwork: forceFreshLoad });
        };

        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [applyPhotoPage, fetchPhotos, forceFreshLoad]);

    useEffect(() => {
        if (!photos.length) return;
        homeFeedSnapshot = { photos, hasMore };
    }, [photos, hasMore]);

    useEffect(() => {
        if (!isOnline) return;
        void reconcileWithServerPhotos(
            photos.map((photo) => ({
                id: photo.id,
                contentHash: photo.contentHash || null,
            })),
        );
    }, [photos, reconcileWithServerPhotos, isOnline]);

    const uploadedPendingCount = useMemo(
        () => pendingItems.filter((item) => item.status === "uploaded").length,
        [pendingItems],
    );

    useEffect(() => {
        if (uploadedPendingCount === 0 || !isOnline) return;
        const timer = window.setTimeout(() => {
            void syncLatest();
        }, POST_UPLOAD_REFRESH_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [uploadedPendingCount, isOnline, syncLatest]);

    useEffect(() => {
        if (!forceFreshLoad) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("fresh");
        const next = params.toString();
        router.replace(next ? `/?${next}` : "/", { scroll: false });
    }, [forceFreshLoad, router, searchParams]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F5") {
                e.preventDefault();
                void syncLatest();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [syncLatest]);

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
            setPullOffset(40);
            await syncLatest();
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
            if (next.has(id)) next.delete(id);
            else next.add(id);
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
        if (!confirm(`Move ${selected.size} selected item(s) to Trash?`)) return;
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

    const openAlbumPicker = async () => {
        if (selected.size === 0 || albumPickerLoading) return;
        setAlbumPickerOpen(true);
        setAlbumPickerLoading(true);
        try {
            const res = await fetch("/api/albums");
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(data?.error || "Failed to load albums"));
            const mapped = Array.isArray(data?.albums) ? data.albums : [];
            setAlbums(mapped);
        } catch (err) {
            console.error("[ALBUM_PICKER] load failed:", err);
        } finally {
            setAlbumPickerLoading(false);
        }
    };

    const addSelectedToAlbum = async (albumId: string) => {
        const photoIds = Array.from(selected);
        if (photoIds.length === 0 || addingToAlbum) return;
        setAddingToAlbum(true);
        try {
            const res = await fetch(`/api/albums/${albumId}/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photoIds }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(data?.error || "Failed to add to album"));
            setSelected(new Set());
            setAlbumPickerOpen(false);
        } catch (err) {
            console.error("[ALBUM_PICKER] add failed:", err);
        } finally {
            setAddingToAlbum(false);
        }
    };

    const serverPhotos = useMemo<ServerGalleryPhoto[]>(() => {
        return photos.map((photo) => ({ ...photo, kind: "server" }));
    }, [photos]);

    const localPendingPhotos = useMemo<LocalGalleryPhoto[]>(() => {
        return pendingItems.map((item) => ({
            kind: "local",
            id: `local:${item.localId}`,
            localId: item.localId,
            url: item.previewUrl,
            thumbUrl: item.previewUrl,
            filename: item.filename,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
            isLiked: false,
            takenAt: item.takenAt,
            durationMs: item.durationMs,
            mediaType: item.mediaType,
            createdAt: item.createdAt,
            status: item.status,
            progress: item.progress,
            error: item.error,
            attempts: item.attempts,
            contentHash: item.contentHash,
        }));
    }, [pendingItems]);

    const viewerContextIds = useMemo(() => {
        return [...photos]
            .sort((a, b) => {
                const dateA = new Date(a.takenAt || a.createdAt).getTime();
                const dateB = new Date(b.takenAt || b.createdAt).getTime();
                return dateB - dateA;
            })
            .map((photo) => photo.id);
    }, [photos]);

    const filteredGalleryPhotos = useMemo<GalleryPhoto[]>(() => {
        if (filter === "favorites") {
            return serverPhotos.filter((photo) => photo.isLiked);
        }
        return [...localPendingPhotos, ...serverPhotos];
    }, [filter, localPendingPhotos, serverPhotos]);

    const sortedPhotos = useMemo<GalleryPhoto[]>(() => {
        return [...filteredGalleryPhotos].sort((a, b) => {
            const dateA = new Date(a.takenAt || a.createdAt).getTime();
            const dateB = new Date(b.takenAt || b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [filteredGalleryPhotos]);

    const groupedPhotos = useMemo(() => {
        const groups: { title: string; photos: GalleryPhoto[] }[] = [];
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

    useHeaderSyncAction(useMemo(() => ({
        label: "Sync",
        loading: syncing,
        onClick: () => {
            void syncLatest();
        },
        ariaLabel: "Sync latest photos",
    }), [syncLatest, syncing]));

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
                {syncing ? <Loader size={24} className="spin" /> : <RefreshCw size={24} style={{ transform: `rotate(${pullOffset * 4}deg)`, opacity: pullOffset / 80 }} />}
            </div>

            <PageHeader
                title={filter === "favorites" ? "Favorites" : "Timeline"}
                actions={(
                    <button className="btn btn-primary btn-sm" onClick={() => router.push("/upload")}>
                        Upload
                    </button>
                )}
            />

            {syncing && photos.length > 0 && (
                <div className="status-banner success" style={{ marginBottom: "1rem", color: "var(--ink-2)" }}>
                    Pulling the latest library data.
                </div>
            )}

            {loading && photos.length === 0 && (
                <div className="empty-state" style={{ minHeight: "50vh" }}>
                    <Loader size={32} className="spin" color="var(--accent)" />
                </div>
            )}

            {error && (
                <div className="status-banner error" style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1.5rem", display: "grid", gap: "0.6rem" }}>
                    <span>{error}</span>
                    <button className="btn btn-secondary btn-sm" style={{ width: "fit-content" }} onClick={() => void syncLatest()}>
                        Sync again
                    </button>
                </div>
            )}

            {!loading && !error && filteredGalleryPhotos.length === 0 && (
                <div className="empty-state" style={{ minHeight: "50vh" }}>
                    <p className="empty-state-title" style={{ fontSize: '1.25rem' }}>{filter === "favorites" ? "No favorites yet" : "No photos yet"}</p>
                    <button className="btn btn-primary" onClick={() => router.push("/upload")} style={{ marginTop: "1.5rem" }}>Upload Photos</button>
                </div>
            )}

            {groupedPhotos.map((group) => {
                const selectableServerIds = group.photos
                    .filter((photo): photo is ServerGalleryPhoto => photo.kind === "server")
                    .map((photo) => photo.id);
                const allSelectableSelected =
                    selectableServerIds.length > 0 &&
                    selectableServerIds.every((id) => selected.has(id));

                return (
                    <div key={group.title} style={{ marginBottom: "3rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", padding: "0 4px" }}>
                            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink-2)" }}>{group.title}</h2>
                            {selectMode && selectableServerIds.length > 0 && (
                                <button
                                    onClick={() => toggleGroupSelection(selectableServerIds)}
                                    style={{
                                        background: allSelectableSelected ? "var(--accent)" : "var(--bg-elevated)",
                                        border: `2px solid ${allSelectableSelected ? "var(--bg-elevated)" : "var(--accent)"}`,
                                        cursor: "pointer", color: "var(--bg-elevated)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        width: 28, height: 28, borderRadius: "50%", transition: "all 150ms ease",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                                    }}
                                >
                                    {allSelectableSelected && <Check size={18} strokeWidth={3.5} />}
                                </button>
                            )}
                        </div>
                        <div className="responsive-grid">
                            {group.photos.map((photo) => {
                                const isLocal = photo.kind === "local";
                                const isSelected = !isLocal && selected.has(photo.id);

                                return (
                                    <div
                                        key={photo.id}
                                        className="press-scale"
                                        style={{
                                            position: "relative",
                                            aspectRatio: "1",
                                            background: "var(--bg-subtle)",
                                            cursor: "pointer",
                                            borderRadius: "var(--r-sm)",
                                            overflow: "hidden",
                                            opacity: selectMode && !isLocal ? (isSelected ? 1 : 0.4) : 1,
                                            WebkitUserSelect: "none",
                                            userSelect: "none",
                                        }}
                                        onTouchStart={() => {
                                            if (!isLocal) startLongPress(photo.id);
                                        }}
                                        onTouchEnd={cancelLongPress}
                                        onTouchMove={cancelLongPress}
                                        onMouseDown={() => {
                                            if (!isLocal) startLongPress(photo.id);
                                        }}
                                        onMouseUp={cancelLongPress}
                                        onMouseLeave={cancelLongPress}
                                        onContextMenu={(e) => {
                                            // Prevent native context menu on long-press
                                            if (!isLocal) e.preventDefault();
                                        }}
                                        onClick={() => {
                                            // Guard: if a long-press just fired, don't navigate
                                            if (longPressTriggered.current) {
                                                longPressTriggered.current = false;
                                                return;
                                            }

                                            if (isLocal) {
                                                // Open local photo in viewer using preview URL
                                                safeSessionStorageSet("local_photo_preview", JSON.stringify({
                                                    id: photo.id,
                                                    url: photo.url,
                                                    thumbUrl: photo.thumbUrl,
                                                    filename: photo.filename,
                                                    mimeType: photo.mimeType,
                                                    sizeBytes: photo.sizeBytes,
                                                    durationMs: photo.durationMs,
                                                    mediaType: photo.mediaType,
                                                    createdAt: photo.createdAt,
                                                }));
                                                safeSessionStorageSet("current_gallery_context", JSON.stringify([photo.id]));
                                                router.push(`/photo/${encodeURIComponent(photo.id)}`);
                                                return;
                                            }

                                            if (selectMode) {
                                                toggleSelect(photo.id);
                                                return;
                                            }

                                            safeSessionStorageSet("current_gallery_context", JSON.stringify(viewerContextIds));
                                            router.push(`/photo/${photo.id}`);
                                        }}
                                    >
                                        {(() => {
                                            const isVideo = mediaTypeOf(photo) === "video";
                                            if (isVideo) {
                                                return (
                                                    <AutoPlayVideoThumb
                                                        id={photo.id}
                                                        src={photo.url}
                                                        poster={photo.thumbUrl && photo.thumbUrl !== photo.url ? photo.thumbUrl : undefined}
                                                    />
                                                );
                                            }
                                            if (isLocal) {
                                                return (
                                                    <img
                                                        src={photo.thumbUrl || photo.url}
                                                        alt=""
                                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                    />
                                                );
                                            }

                                            return (
                                                <CachedImage
                                                    id={photo.id}
                                                    src={photo.thumbUrl || photo.url}
                                                    alt=""
                                                    className="w-full h-full object-cover block transition-opacity duration-150"
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                    category="thumb"
                                                />
                                            );
                                        })()}

                                        {mediaTypeOf(photo) === "video" && (
                                            <div style={{
                                                position: "absolute",
                                                left: 8,
                                                bottom: 8,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 4,
                                                padding: "2px 6px",
                                                borderRadius: 999,
                                                background: "rgba(0,0,0,0.55)",
                                                color: "#fff",
                                                fontSize: 11,
                                                fontWeight: 700,
                                            }}>
                                                <Play size={10} fill="#fff" color="#fff" />
                                                <span>{formatDuration(photo.durationMs)}</span>
                                            </div>
                                        )}

                                        {!isLocal && photo.isLiked && !selectMode && (
                                            <Heart
                                                size={16}
                                                fill="var(--accent)"
                                                color="var(--accent)"
                                                style={{ position: "absolute", bottom: 8, right: 8 }}
                                            />
                                        )}

                                        {isLocal && photo.status === "uploaded" && (
                                            <div style={{
                                                position: "absolute", bottom: 6, right: 6,
                                                width: 20, height: 20, borderRadius: "50%",
                                                background: "rgba(0,0,0,0.5)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}>
                                                <CloudCheck size={13} color="#4ade80" strokeWidth={2.5} />
                                            </div>
                                        )}

                                        {selectMode && !isLocal && (
                                            <div style={{
                                                position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%",
                                                background: isSelected ? "var(--accent)" : "var(--bg-elevated)",
                                                border: `2px solid ${isSelected ? "var(--bg-elevated)" : "var(--accent)"}`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                boxShadow: "0 2px 8px rgba(0,0,0,0.3)", transition: "all 150ms ease"
                                            }}>
                                                {isSelected && <Check size={16} color="var(--bg-elevated)" strokeWidth={4} />}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

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
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <button
                                onClick={() => setSelected(new Set())}
                                style={{ border: "none", background: "none", color: "var(--muted)", padding: 0, display: "flex", cursor: "pointer" }}
                            >
                                <X size={20} />
                            </button>
                            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{selected.size} selected</span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button className="btn btn-sm btn-secondary" onClick={openAlbumPicker} disabled={deleting}>
                                <FolderPlus size={14} />
                                Add to Album
                            </button>
                            <button className="btn btn-sm" style={{ background: "var(--error)", color: "#fff", gap: "0.35rem", border: "none", fontWeight: 700 }} onClick={handleDelete} disabled={deleting}>
                                {deleting ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                                Delete
                            </button>
                        </div>
                    </div>
                )
            }

            {albumPickerOpen && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.45)",
                    zIndex: 80,
                    display: "grid",
                    placeItems: "center",
                    padding: "1rem",
                }} onClick={() => !addingToAlbum && setAlbumPickerOpen(false)}>
                    <div className="panel" style={{ width: "min(460px, 100%)", maxHeight: "70vh", overflowY: "auto" }} onClick={(event) => event.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                            <p className="section-heading">Add {selected.size} item(s) to album</p>
                            <button className="btn btn-ghost btn-sm" onClick={() => setAlbumPickerOpen(false)} disabled={addingToAlbum}>
                                <X size={14} />
                            </button>
                        </div>

                        {albumPickerLoading ? (
                            <div className="empty-state" style={{ minHeight: 140 }}>
                                <Loader size={22} className="spin" color="var(--accent)" />
                            </div>
                        ) : albums.length === 0 ? (
                            <div style={{ color: "var(--muted)", fontSize: "0.86rem", display: "grid", gap: "0.55rem" }}>
                                <p>No albums found.</p>
                                <button className="btn btn-secondary btn-sm" onClick={() => router.push("/albums")}>
                                    Create Album
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: "0.55rem" }}>
                                {albums.map((album) => (
                                    <button
                                        key={album.id}
                                        className="album-picker-item"
                                        onClick={() => addSelectedToAlbum(album.id)}
                                        disabled={addingToAlbum}
                                    >
                                        <span style={{ textAlign: "left" }}>{album.name}</span>
                                        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{album.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div >
    );
}

function AutoPlayVideoThumb({ src, poster }: { id: string; src: string; poster?: string }) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [inView, setInView] = useState(false);
    const [canAutoplay, setCanAutoplay] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
        setCanAutoplay(!prefersReducedMotion && !coarsePointer);
    }, []);

    useEffect(() => {
        if (!canAutoplay) return;

        const el = videoRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6);
            },
            { threshold: [0, 0.6, 1] },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [canAutoplay]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        if (!canAutoplay || !inView) {
            el.pause();
            return;
        }

        const playPromise = el.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => { });
        }
    }, [canAutoplay, inView]);

    return (
        <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            preload={canAutoplay || !poster ? "metadata" : "none"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
    );
}
