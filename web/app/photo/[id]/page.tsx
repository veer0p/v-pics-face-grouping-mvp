"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use } from "react";
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
    const { id } = use(params);
    const router = useRouter();
    const [photo, setPhoto] = useState<PhotoDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [liked, setLiked] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [idList, setIdList] = useState<string[]>([]);

    useEffect(() => {
        const stored = sessionStorage.getItem("current_gallery_context");
        if (stored) {
            try { setIdList(JSON.parse(stored)); } catch (e) { console.error(e); }
        }
    }, [id]);

    const currentIndex = idList.indexOf(id);
    const prevId = currentIndex > 0 ? idList[currentIndex - 1] : null;
    const nextId = currentIndex < idList.length - 1 ? idList[currentIndex + 1] : null;

    const navigate = (newId: string | null) => {
        if (!newId) return;
        setLoading(true);
        router.replace(`/photo/${newId}`);
    };

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" && prevId) navigate(prevId);
            if (e.key === "ArrowRight" && nextId) navigate(nextId);
            if (e.key === "Escape") router.back();
        };
        window.addEventListener("keydown", handleKeys);
        return () => window.removeEventListener("keydown", handleKeys);
    }, [prevId, nextId, router]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                // 1. Fetch via Smart Cache (Handles hit, miss, and deduplication)
                const data = await PhotoDetailCache.fetchAndCache(id);

                if (active && data) {
                    setPhoto(data);
                    setLiked(data.isLiked);
                }
            } catch (err) {
                if (active) setError(true);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [id]);

    const toggleLike = async () => {
        if (!photo) return;
        const next = !liked;
        setLiked(next);
        const updatedPhoto = { ...photo, isLiked: next };
        setPhoto(updatedPhoto);

        // Optimistic cache update
        await PhotoDetailCache.set(photo.id, updatedPhoto);

        await fetch("/api/photos/favorite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: photo.id, liked: next }),
        });
    };

    const handleDelete = async () => {
        if (!photo) return;
        await fetch("/api/photos/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [photo.id] }),
        });
        router.back();
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

    // Loading state
    if (loading) {
        return (
            <div style={{
                position: "fixed", inset: 0, zIndex: 100, background: "#000",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <Loader size={28} className="spin" color="#fff" />
            </div>
        );
    }

    // Error state
    if (error || !photo) {
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

    // Camera info string
    const cameraInfo = [photo.cameraModel, photo.lensModel].filter(Boolean).join(" • ");
    const shootingInfo = [
        photo.focalLength ? `${photo.focalLength}mm` : null,
        photo.aperture ? `ƒ/${photo.aperture}` : null,
        photo.shutterSpeed ? photo.shutterSpeed : null,
        photo.iso ? `ISO ${photo.iso}` : null,
    ].filter(Boolean).join("  ·  ");

    return (
        <>
            <div style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "#000", display: "flex", flexDirection: "column",
            }}>
                <div className="photo-viewer-container">
                    {/* Main Content (Image) */}
                    <div className="photo-viewer-main">
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "0.85rem 1rem",
                            paddingTop: "calc(0.85rem + env(safe-area-inset-top))",
                            background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
                            position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
                        }}>
                            <button onClick={() => router.back()} style={{ ...btnStyle, color: "#fff" }}>
                                <ArrowLeft size={24} />
                            </button>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button onClick={toggleLike} style={btnStyle}>
                                    <Heart size={22} color={liked ? "#ff4d6a" : "#fff"}
                                        fill={liked ? "#ff4d6a" : "none"} strokeWidth={2} />
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

                        <ZoomableImage
                            id={photo.id}
                            src={photo.url}
                            alt={photo.filename}
                            thumbUrl={photo.thumbUrl}
                            onSwipeLeft={() => nextId && navigate(nextId)}
                            onSwipeRight={() => prevId && navigate(prevId)}
                        />

                        {/* Side Arrows (Desktop) */}
                        <div className="desktop-only">
                            {prevId && (
                                <button
                                    onClick={() => navigate(prevId)}
                                    className="nav-arrow-btn"
                                    style={{ left: "1.5rem" }}
                                >
                                    <ChevronLeft size={36} />
                                </button>
                            )}
                            {nextId && (
                                <button
                                    onClick={() => navigate(nextId)}
                                    className="nav-arrow-btn"
                                    style={{ right: "1.5rem" }}
                                >
                                    <ChevronRight size={36} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Desktop Aside (Details) */}
                    {showInfo && (
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

                            {/* Camera section */}
                            {(cameraInfo || shootingInfo) && (
                                <div style={{
                                    background: "var(--bg-subtle)", borderRadius: "var(--r-md)",
                                    padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--line)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                                        <Camera size={20} color="var(--accent)" />
                                        <span style={{ fontSize: "1rem", fontWeight: 700 }}>{cameraInfo || "Camera"}</span>
                                    </div>
                                    {shootingInfo && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <Aperture size={18} color="var(--muted)" />
                                            <span style={{ fontSize: "0.9rem", color: "var(--ink-2)", fontFamily: "monospace" }}>
                                                {shootingInfo}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* GPS */}
                            {photo.gpsLat && photo.gpsLng && (
                                <div style={{
                                    background: "var(--bg-subtle)", borderRadius: "var(--r-md)",
                                    padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--line)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <MapPin size={20} color="var(--success)" />
                                        <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                                            {photo.gpsLat.toFixed(6)}, {photo.gpsLng.toFixed(6)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* File info */}
                            <div style={{
                                display: "grid", gap: "0.75rem", fontSize: "0.9rem",
                                color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: "1.5rem"
                            }}>
                                <Row label="Filename" value={photo.filename} />
                                {photo.width && photo.height && (
                                    <Row label="Resolution" value={`${photo.width} × ${photo.height} px`} />
                                )}
                                <Row label="Size" value={formatBytes(photo.sizeBytes)} />
                                <Row label="Format" value={photo.mimeType.replace("image/", "").toUpperCase()} />
                                <Row label="Uploaded" value={formatDate(photo.createdAt)} />
                            </div>
                        </aside>
                    )}
                </div>

                {/* Mobile Info panel — slides up from bottom */}
                {showInfo && (
                    <div className="mobile-only" style={{
                        position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "70vh",
                        overflowY: "auto", background: "var(--bg-elevated)", backdropFilter: "blur(20px)",
                        padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
                        borderRadius: "1.5rem 1.5rem 0 0", zIndex: 30,
                        animation: "slide-up-sheet 300ms cubic-bezier(0.16,1,0.3,1)",
                        color: "var(--ink)", borderTop: "1px solid var(--line)"
                    }}>
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                            <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>Details</span>
                            <button onClick={() => setShowInfo(false)} style={{ ...btnStyle, color: "var(--muted)" }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Info rows same as desktop but for mobile sheet */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {photo.takenAt && (
                                <div>
                                    <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>{formatDate(photo.takenAt)}</p>
                                </div>
                            )}

                            {(cameraInfo || shootingInfo) && (
                                <div style={{ background: "var(--bg-subtle)", borderRadius: "1rem", padding: "1rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                        <Camera size={18} color="var(--accent)" />
                                        <span style={{ fontSize: "1rem", fontWeight: 600 }}>{cameraInfo || "Camera"}</span>
                                    </div>
                                    {shootingInfo && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <Aperture size={16} color="var(--muted)" />
                                            <span style={{ fontSize: "0.85rem", color: "var(--ink-2)", fontFamily: "monospace" }}>
                                                {shootingInfo}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {photo.gpsLat && photo.gpsLng && (
                                <div style={{ background: "var(--bg-subtle)", borderRadius: "1rem", padding: "1rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <MapPin size={18} color="var(--success)" />
                                        <span style={{ fontSize: "0.9rem" }}>
                                            {photo.gpsLat.toFixed(5)}, {photo.gpsLng.toFixed(5)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                                <Row label="Filename" value={photo.filename} />
                                {photo.width && photo.height && (
                                    <Row label="Resolution" value={`${photo.width} × ${photo.height} px`} />
                                )}
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
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 200ms ease;
                z-index: 30;
                border: none;
                padding: 0;
            }
            .nav-arrow-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-50%) scale(1.1);
            }
            .nav-arrow-btn:active {
                transform: translateY(-50%) scale(0.95);
            }
            .shimmer {
                background: linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0) 0%,
                    rgba(255, 255, 255, 0.2) 50%,
                    rgba(255, 255, 255, 0) 100%
                );
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            @keyframes slide-up-sheet {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            `}</style>
        </>
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

function ZoomableImage({ id, src, alt, thumbUrl, onSwipeLeft, onSwipeRight }: {
    id: string; src: string; alt: string; thumbUrl: string;
    onSwipeLeft?: () => void; onSwipeRight?: () => void;
}) {
    const [scale, setScale] = useState(1);
    const [panning, setPanning] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [start, setStart] = useState({ x: 0, y: 0 });
    const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
    const [fullLoaded, setFullLoaded] = useState(false);
    const [pinchStartDist, setPinchStartDist] = useState<number | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                // Fetch from Cache API or Network
                const url = await ImageBlobCache.fetchAndCache(id, src, 'full');
                if (isMounted) setBlobUrl(url);
            } catch (err) {
                console.warn("❌ B2 (Caching failed for single photo, falling back)", err);
                if (isMounted) setBlobUrl(src);
            }
        })();
        return () => { isMounted = false; };
    }, [src]);

    const onWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY;
        const nextScale = Math.min(Math.max(1, scale - delta / 250), 5); // Faster zoom (was 500)
        if (nextScale === 1) setPos({ x: 0, y: 0 });
        setScale(nextScale);
    };

    const handleStart = (clientX: number, clientY: number) => {
        if (scale > 1) {
            setPanning(true);
            setStart({ x: clientX - pos.x, y: clientY - pos.y });
        }
        setTouchStartPos({ x: clientX, y: clientY });
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (panning) {
            setPos({ x: clientX - start.x, y: clientY - start.y });
        }
    };

    const handleEnd = (clientX?: number, clientY?: number) => {
        setPanning(false);
        // Swipe Detection (only when not zoomed)
        if (clientX !== undefined && clientY !== undefined && scale === 1) {
            const deltaX = clientX - touchStartPos.x;
            const deltaY = clientY - touchStartPos.y;
            if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 40) {
                if (deltaX > 0) onSwipeRight?.();
                else onSwipeLeft?.();
            }
        }
    };

    // Touch support for pinch-to-zoom
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setPinchStartDist(dist);
        } else if (e.touches.length === 1) {
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchStartDist !== null) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = (dist / pinchStartDist);
            const zoomPower = 1.1; // Boost zoom speed
            const nextScale = Math.min(Math.max(1, scale * Math.pow(delta, zoomPower)), 5);
            setScale(nextScale);
            setPinchStartDist(dist);
        } else if (e.touches.length === 1) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const toggleZoom = () => {
        if (scale > 1) {
            setScale(1);
            setPos({ x: 0, y: 0 });
        } else {
            setScale(2.5);
        }
    };

    return (
        <div
            style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", position: "relative", width: "100%", height: "100%",
                touchAction: "none", cursor: scale > 1 ? "grab" : "default"
            }}
            onWheel={onWheel}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={(e) => handleEnd(e.clientX, e.clientY)}
            onMouseLeave={() => handleEnd()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={(e) => {
                const touch = e.changedTouches[0];
                handleEnd(touch?.clientX, touch?.clientY);
            }}
            onDoubleClick={toggleZoom}
        >
            {!fullLoaded && (
                <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                    <img src={thumbUrl} alt="" style={{
                        position: "absolute", width: "100%", height: "100%",
                        objectFit: "contain", filter: "blur(20px)", transform: `scale(${scale * 1.1}) translate(${pos.x}px, ${pos.y}px)`,
                    }} />
                    <div className="shimmer" style={{ position: "absolute", inset: 0, zIndex: 1, opacity: 0.2 }} />
                </div>
            )}
            <img
                src={blobUrl || src}
                alt={alt}
                onLoad={() => setFullLoaded(true)}
                draggable={false}
                style={{
                    maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                    opacity: fullLoaded ? 1 : 0,
                    transition: panning ? "none" : "transform 150ms cubic-bezier(0.2, 0, 0.2, 1), opacity 500ms ease",
                    transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`,
                    position: "relative", zIndex: 1,
                    userSelect: "none"
                }}
            />
        </div>
    );
}
