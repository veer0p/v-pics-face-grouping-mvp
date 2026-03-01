"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Heart, Trash2, Download, Info, Loader, X,
    Camera, Aperture, MapPin, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ImageBlobCache, PhotoDetailCache } from "@/lib/photo-cache";

type PhotoDetail = {
    id: string;
    url: string;
    thumbUrl: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    isLiked: boolean;
    blurhash: string | null;
    takenAt: string | null;
    cameraMake: string | null;
    cameraModel: string | null;
    lensModel: string | null;
    focalLength: number | null;
    aperture: number | null;
    iso: number | null;
    shutterSpeed: string | null;
    gpsLat: number | null;
    gpsLng: number | null;
    createdAt: string;
};

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

export default function PhotoViewerPage({ params }: { params: Promise<{ id: string }> }) {
    const initialId = use(params).id;
    const router = useRouter();

    // Core State
    const [idList, setIdList] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [photos, setPhotos] = useState<Record<string, PhotoDetail>>({});
    const [idAtCenter, setIdAtCenter] = useState(initialId); // For URL sync

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    // Initialize ID List from context
    useEffect(() => {
        const stored = sessionStorage.getItem("current_gallery_context");
        if (stored) {
            try {
                const list = JSON.parse(stored);
                setIdList(list);
                setCurrentIndex(list.indexOf(initialId));
            } catch (e) { console.error(e); }
        } else {
            // Fallback for direct link
            setIdList([initialId]);
            setCurrentIndex(0);
        }
    }, [initialId]);

    // Preloading Logic
    const preload = useCallback(async (id: string) => {
        if (!id || photos[id]) return;
        try {
            const data = await PhotoDetailCache.fetchAndCache(id);
            if (data) {
                setPhotos(prev => ({ ...prev, [id]: data }));
                // Preload the image blob too (quietly)
                ImageBlobCache.fetchAndCache(id, data.url, 'full').catch(() => { });
            }
        } catch (err) {
            console.warn("Preload failed for", id, err);
        }
    }, [photos]);

    // Load current and adjacent
    useEffect(() => {
        if (currentIndex === -1) return;

        const currentId = idList[currentIndex];
        const prevId = currentIndex > 0 ? idList[currentIndex - 1] : null;
        const nextId = currentIndex < idList.length - 1 ? idList[currentIndex + 1] : null;

        setLoading(!photos[currentId]);

        preload(currentId);
        if (prevId) preload(prevId);
        if (nextId) preload(nextId);

        // Sync URL (silently)
        if (currentId !== idAtCenter) {
            setIdAtCenter(currentId);
            window.history.replaceState(null, "", `/photo/${currentId}`);
        }
    }, [currentIndex, idList, preload, photos, idAtCenter]);

    const navigate = (dir: 'next' | 'prev') => {
        if (dir === 'next' && currentIndex < idList.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else if (dir === 'prev' && currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    // Keyboard support
    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") navigate('prev');
            if (e.key === "ArrowRight") navigate('next');
            if (e.key === "Escape") router.back();
        };
        window.addEventListener("keydown", handleKeys);
        return () => window.removeEventListener("keydown", handleKeys);
    }, [currentIndex, idList, router]);

    const photo = photos[idList[currentIndex]];

    const toggleLike = async () => {
        if (!photo) return;
        const nextLiked = !photo.isLiked;
        const updatedPhoto = { ...photo, isLiked: nextLiked };

        setPhotos(prev => ({ ...prev, [photo.id]: updatedPhoto }));
        await PhotoDetailCache.set(photo.id, updatedPhoto);

        await fetch("/api/photos/favorite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: photo.id, liked: nextLiked }),
        });
    };

    const handleDelete = async () => {
        if (!photo) return;
        const idToDelete = photo.id;

        const newList = idList.filter(id => id !== idToDelete);
        setIdList(newList);

        if (newList.length === 0) {
            router.back();
        } else {
            setCurrentIndex(Math.min(currentIndex, newList.length - 1));
        }

        await fetch("/api/photos/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [idToDelete] }),
        });
    };

    const handleDownload = async () => {
        if (!photo) return;
        try {
            const response = await fetch(photo.url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = photo.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(photo.url, "_blank");
        }
    };

    if (error) {
        return (
            <div style={{
                position: "fixed", inset: 0, zIndex: 100, background: "var(--bg)",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "1rem", color: "var(--ink)",
            }}>
                <p style={{ fontWeight: 600 }}>Photo not found</p>
                <button onClick={() => router.back()} style={{
                    background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--ink)",
                    padding: "0.6rem 1.5rem", borderRadius: "var(--r-md)", cursor: "pointer",
                    fontWeight: 600,
                }}>Go Back</button>
            </div>
        );
    }

    const btnStyle: React.CSSProperties = {
        background: "none", border: "none", cursor: "pointer",
        padding: "0.5rem", minHeight: "unset", borderRadius: "50%",
        WebkitTapHighlightColor: "transparent",
    };

    const cameraInfo = photo ? [photo.cameraModel, photo.lensModel].filter(Boolean).join(" • ") : "";
    const shootingInfo = photo ? [
        photo.focalLength ? `${photo.focalLength}mm` : null,
        photo.aperture ? `ƒ/${photo.aperture}` : null,
        photo.shutterSpeed ? photo.shutterSpeed : null,
        photo.iso ? `ISO ${photo.iso}` : null,
    ].filter(Boolean).join("  ·  ") : "";

    return (
        <>
            <div style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "#000", display: "flex", flexDirection: "column",
            }}>
                <div className="photo-viewer-container">
                    <div className="photo-viewer-main" style={{ position: "relative", overflow: "hidden" }}>
                        {/* Header */}
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "0.85rem 1rem",
                            paddingTop: "calc(0.85rem + env(safe-area-inset-top))",
                            background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
                            position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
                        }}>
                            <button onClick={() => router.back()} style={{ ...btnStyle, color: "#fff" }}>
                                <ArrowLeft size={24} />
                            </button>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button onClick={toggleLike} style={btnStyle}>
                                    <Heart size={22} color={photo?.isLiked ? "#ff4d6a" : "#fff"}
                                        fill={photo?.isLiked ? "#ff4d6a" : "none"} strokeWidth={2} />
                                </button>
                                <button onClick={() => setShowInfo(!showInfo)} style={{ ...btnStyle, color: showInfo ? "#60a5fa" : "#fff" }}>
                                    <Info size={22} />
                                </button>
                                <button onClick={handleDownload} style={{ ...btnStyle, color: "#fff" }}>
                                    <Download size={22} />
                                </button>
                                <button onClick={handleDelete} style={{ ...btnStyle, color: "#f87171" }}>
                                    <Trash2 size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Photo Slider */}
                        <PhotoSlider
                            idList={idList}
                            currentIndex={currentIndex}
                            photos={photos}
                            onNavigate={setCurrentIndex}
                        />

                        {/* Desktop Side Arrows */}
                        <div className="desktop-only">
                            {currentIndex > 0 && (
                                <button onClick={() => navigate('prev')} className="nav-arrow-btn" style={{ left: "1.5rem" }}>
                                    <ChevronLeft size={36} />
                                </button>
                            )}
                            {currentIndex < idList.length - 1 && (
                                <button onClick={() => navigate('next')} className="nav-arrow-btn" style={{ right: "1.5rem" }}>
                                    <ChevronRight size={36} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Desktop Details Aside */}
                    {showInfo && photo && (
                        <aside className="photo-viewer-aside desktop-only">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>Details</h2>
                            </div>
                            {photo.takenAt && (
                                <div style={{ marginBottom: "2rem" }}>
                                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>{formatDate(photo.takenAt)}</p>
                                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>Original capture time</p>
                                </div>
                            )}
                            {(cameraInfo || shootingInfo) && (
                                <div style={{ background: "var(--bg-subtle)", borderRadius: "var(--r-md)", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--line)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                                        <Camera size={20} color="var(--accent)" />
                                        <span style={{ fontSize: "1rem", fontWeight: 700 }}>{cameraInfo || "Camera"}</span>
                                    </div>
                                    {shootingInfo && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <Aperture size={18} color="var(--muted)" />
                                            <span style={{ fontSize: "0.9rem", color: "var(--ink-2)", fontFamily: "monospace" }}>{shootingInfo}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {photo.gpsLat && photo.gpsLng && (
                                <div style={{ background: "var(--bg-subtle)", borderRadius: "var(--r-md)", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--line)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <MapPin size={20} color="var(--success)" />
                                        <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{photo.gpsLat.toFixed(6)}, {photo.gpsLng.toFixed(6)}</span>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.9rem", color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
                                <Row label="Filename" value={photo.filename} />
                                {photo.width && photo.height && <Row label="Resolution" value={`${photo.width} × ${photo.height} px`} />}
                                <Row label="Size" value={formatBytes(photo.sizeBytes)} />
                                <Row label="Format" value={photo.mimeType.replace("image/", "").toUpperCase()} />
                                <Row label="Uploaded" value={formatDate(photo.createdAt)} />
                            </div>
                        </aside>
                    )}
                </div>

                {/* Mobile Info Sheet */}
                {showInfo && photo && (
                    <div className="mobile-only" style={{ ...sheetStyle }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                            <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>Details</span>
                            <button onClick={() => setShowInfo(false)} style={{ ...btnStyle, color: "var(--muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {photo.takenAt && <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>{formatDate(photo.takenAt)}</p>}
                            {(cameraInfo || shootingInfo) && (
                                <div style={{ background: "var(--bg-subtle)", borderRadius: "1rem", padding: "1rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                        <Camera size={18} color="var(--accent)" />
                                        <span style={{ fontSize: "1rem", fontWeight: 600 }}>{cameraInfo || "Camera"}</span>
                                    </div>
                                    {shootingInfo && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <Aperture size={16} color="var(--muted)" />
                                            <span style={{ fontSize: "0.85rem", color: "var(--ink-2)", fontFamily: "monospace" }}>{shootingInfo}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {photo.gpsLat && photo.gpsLng && (
                                <div style={{ background: "var(--bg-subtle)", borderRadius: "1rem", padding: "1rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <MapPin size={18} color="var(--success)" />
                                        <span style={{ fontSize: "0.9rem" }}>{photo.gpsLat.toFixed(5)}, {photo.gpsLng.toFixed(5)}</span>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                                <Row label="Filename" value={photo.filename} />
                                {photo.width && photo.height && <Row label="Resolution" value={`${photo.width} × ${photo.height} px`} />}
                                <Row label="Size" value={formatBytes(photo.sizeBytes)} />
                                <Row label="Format" value={photo.mimeType.replace("image/", "").toUpperCase()} />
                                <Row label="Uploaded" value={formatDate(photo.createdAt)} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .nav-arrow-btn {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.2); color: #fff;
                    width: 56px; height: 56px; border-radius: 50%;
                    display: flex; alignItems: center; justifyContent: center;
                    cursor: pointer; transition: all 200ms ease; z-index: 60;
                }
                .nav-arrow-btn:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-50%) scale(1.1); }
                .shimmer {
                    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
                    background-size: 200% 100%; animation: shimmer 1.5s infinite;
                }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes slide-up-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
        </>
    );
}

const sheetStyle: React.CSSProperties = {
    position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "70vh",
    overflowY: "auto", background: "var(--bg-elevated)", backdropFilter: "blur(20px)",
    padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
    borderRadius: "1.5rem 1.5rem 0 0", zIndex: 110,
    color: "var(--ink)", borderTop: "1px solid var(--line)"
};

/* --- Optimized Slider Component --- */

function PhotoSlider({ idList, currentIndex, photos, onNavigate }: {
    idList: string[];
    currentIndex: number;
    photos: Record<string, PhotoDetail>;
    onNavigate: (index: number) => void;
}) {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Use refs to avoid stale closures in event handlers
    const dragXRef = useRef(0);
    const startXRef = useRef(0);
    const currentIndexRef = useRef(currentIndex);
    const idListRef = useRef(idList);

    useEffect(() => {
        currentIndexRef.current = currentIndex;
        idListRef.current = idList;
    }, [currentIndex, idList]);

    const handleStart = (clientX: number) => {
        startXRef.current = clientX;
        dragXRef.current = 0;
        setIsDragging(true);
        setIsAnimating(false);
    };

    const handleMove = (clientX: number) => {
        if (!isDragging) return;
        const delta = clientX - startXRef.current;
        dragXRef.current = delta;
        setDragX(delta);
    };

    const handleEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        const finalDragX = dragXRef.current;
        const width = window.innerWidth;
        const threshold = width / 4;

        if (finalDragX > threshold && currentIndexRef.current > 0) {
            onNavigate(currentIndexRef.current - 1);
        } else if (finalDragX < -threshold && currentIndexRef.current < idListRef.current.length - 1) {
            onNavigate(currentIndexRef.current + 1);
        }

        setDragX(0);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
    };

    const renderSlide = (index: number, offset: number) => {
        const id = idList[index];
        if (!id) return null;
        const photo = photos[id];

        return (
            <div key={id} style={{
                position: "absolute",
                top: 0, left: 0, width: "100%", height: "100%",
                transform: `translateX(${(offset * 100) + (dragX / window.innerWidth * 100)}%)`,
                transition: isDragging || !isAnimating ? "none" : "transform 300ms cubic-bezier(0.2, 0, 0, 1)",
                display: "flex", alignItems: "center", justifyContent: "center"
            }}>
                {photo ? (
                    <ZoomableImage
                        id={photo.id} src={photo.url}
                        thumbUrl={photo.thumbUrl}
                        alt={photo.filename}
                        isCurrent={offset === 0}
                    />
                ) : (
                    <Loader className="spin" color="#fff" />
                )}
            </div>
        );
    };

    return (
        <div
            style={{ width: "100%", height: "100%", position: "relative", touchAction: "none" }}
            onMouseDown={(e) => {
                handleStart(e.clientX);
                const onMouseMove = (me: MouseEvent) => handleMove(me.clientX);
                const onMouseUp = () => {
                    handleEnd();
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            }}
            onTouchStart={(e) => {
                handleStart(e.touches[0].clientX);
            }}
            onTouchMove={(e) => {
                handleMove(e.touches[0].clientX);
                if (Math.abs(dragXRef.current) > 10) {
                    if (e.cancelable) e.preventDefault();
                }
            }}
            onTouchEnd={handleEnd}
        >
            {renderSlide(currentIndex - 1, -1)}
            {renderSlide(currentIndex, 0)}
            {renderSlide(currentIndex + 1, 1)}
        </div>
    );
}

function ZoomableImage({ id, src, thumbUrl, alt, isCurrent }: {
    id: string; src: string; thumbUrl: string; alt: string; isCurrent: boolean;
}) {
    const [scale, setScale] = useState(1);
    const [fullLoaded, setFullLoaded] = useState(false);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => { if (!isCurrent) setScale(1); }, [isCurrent]);

    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        (async () => {
            try {
                const url = await ImageBlobCache.fetchAndCache(id, src, 'full', signal);
                setBlobUrl(url);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.warn("❌ Cache/Fetch failure, falling back to src", err);
                setBlobUrl(src);
            }
        })();
        return () => controller.abort();
    }, [id, src]);

    return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            {!fullLoaded && (
                <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                    <img src={thumbUrl} alt="" style={{ position: "absolute", width: "100%", height: "100%", objectFit: "contain", filter: "blur(20px)" }} />
                    <div className="shimmer" style={{ position: "absolute", inset: 0, zIndex: 1, opacity: 0.2 }} />
                </div>
            )}
            <img
                src={blobUrl || src} alt={alt}
                onLoad={() => setFullLoaded(true)}
                draggable={false}
                style={{
                    maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                    opacity: fullLoaded ? 1 : 0,
                    transform: `scale(${scale})`,
                    transition: "transform 200ms ease, opacity 300ms ease",
                    zIndex: 1, userSelect: "none"
                }}
            />
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>{label}</span>
            <span style={{ color: "var(--ink)", fontWeight: 500, textAlign: "right", maxWidth: "65%", wordBreak: "break-all" }}>{value}</span>
        </div>
    );
}
