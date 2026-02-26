"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Heart, Trash2, Download, Info, Loader, X,
    Camera, Aperture, MapPin,
} from "lucide-react";

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
    const [fullLoaded, setFullLoaded] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await fetch(`/api/photos/${id}`);
                if (!res.ok) throw new Error("Not found");
                const data = await res.json();
                if (active) {
                    setPhoto(data.photo);
                    setLiked(data.photo.isLiked);
                }
            } catch {
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
                position: "fixed", inset: 0, zIndex: 100, background: "#000",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "1rem", color: "#fff",
            }}>
                <p>Photo not found</p>
                <button onClick={() => router.back()} style={{
                    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                    padding: "0.5rem 1.25rem", borderRadius: "0.5rem", cursor: "pointer",
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
        <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "#000", display: "flex", flexDirection: "column",
        }}>
            {/* Top bar */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.65rem 0.75rem",
                paddingTop: "calc(0.65rem + env(safe-area-inset-top))",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
                position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
            }}>
                <button onClick={() => router.back()} style={{ ...btnStyle, color: "#fff" }}>
                    <ArrowLeft size={22} />
                </button>
                <div style={{ display: "flex", gap: "0.15rem" }}>
                    <button onClick={toggleLike} style={btnStyle}>
                        <Heart size={20} color={liked ? "#ff4d6a" : "#fff"}
                            fill={liked ? "#ff4d6a" : "none"} strokeWidth={2} />
                    </button>
                    <button onClick={() => setShowInfo(!showInfo)} style={{ ...btnStyle, color: showInfo ? "#60a5fa" : "#fff" }}>
                        <Info size={20} />
                    </button>
                    <button onClick={handleDownload} style={{ ...btnStyle, color: "#fff" }}>
                        <Download size={20} />
                    </button>
                    <button onClick={handleDelete} style={{ ...btnStyle, color: "#f87171" }}>
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* Full-res image with blur-up */}
            <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", position: "relative",
            }}>
                {!fullLoaded && (
                    <img src={photo.thumbUrl} alt="" style={{
                        position: "absolute", width: "100%", height: "100%",
                        objectFit: "contain", filter: "blur(12px)", transform: "scale(1.05)",
                    }} />
                )}
                <img
                    src={photo.url}
                    alt={photo.filename}
                    onLoad={() => setFullLoaded(true)}
                    style={{
                        maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                        opacity: fullLoaded ? 1 : 0, transition: "opacity 400ms ease",
                        position: "relative", zIndex: 1,
                    }}
                />
            </div>

            {/* Info panel — slides up from bottom */}
            {showInfo && (
                <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "60vh",
                    overflowY: "auto", background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)",
                    padding: "1.25rem", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
                    borderRadius: "1.25rem 1.25rem 0 0",
                    animation: "slide-up-sheet 250ms cubic-bezier(0.16,1,0.3,1)",
                    color: "#fff",
                }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "1rem" }}>Details</span>
                        <button onClick={() => setShowInfo(false)} style={{ ...btnStyle, color: "#aaa" }}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Date */}
                    {photo.takenAt && (
                        <div style={{ marginBottom: "1rem" }}>
                            <p style={{ fontSize: "1rem", fontWeight: 600 }}>{formatDate(photo.takenAt)}</p>
                        </div>
                    )}

                    {/* Camera section */}
                    {(cameraInfo || shootingInfo) && (
                        <div style={{
                            background: "rgba(255,255,255,0.08)", borderRadius: "0.75rem",
                            padding: "0.85rem", marginBottom: "0.75rem",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                                <Camera size={16} color="#60a5fa" />
                                <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{cameraInfo || "Camera"}</span>
                            </div>
                            {shootingInfo && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Aperture size={14} color="#888" />
                                    <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>
                                        {shootingInfo}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* GPS */}
                    {photo.gpsLat && photo.gpsLng && (
                        <div style={{
                            background: "rgba(255,255,255,0.08)", borderRadius: "0.75rem",
                            padding: "0.85rem", marginBottom: "0.75rem",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <MapPin size={16} color="#34d399" />
                                <span style={{ fontSize: "0.85rem" }}>
                                    {photo.gpsLat.toFixed(4)}, {photo.gpsLng.toFixed(4)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* File info */}
                    <div style={{
                        display: "grid", gap: "0.45rem", fontSize: "0.82rem",
                        color: "rgba(255,255,255,0.65)",
                    }}>
                        <Row label="Filename" value={photo.filename} />
                        {photo.width && photo.height && (
                            <Row label="Resolution" value={`${photo.width} × ${photo.height} px`} />
                        )}
                        <Row label="Size" value={formatBytes(photo.sizeBytes)} />
                        <Row label="Format" value={photo.mimeType.replace("image/", "").toUpperCase()} />
                        <Row label="Uploaded" value={formatDate(photo.createdAt)} />
                    </div>
                </div>
            )}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
            <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500, textAlign: "right", maxWidth: "65%", wordBreak: "break-all" }}>{value}</span>
        </div>
    );
}
