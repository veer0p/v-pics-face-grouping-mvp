"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    ArrowLeft, MoreVertical, Heart, Pencil, Share2, Trash2,
    MapPin, Camera as CameraIcon, Maximize, Users, ChevronUp,
} from "lucide-react";

export default function PhotoViewerPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const [chromeVisible, setChromeVisible] = useState(true);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [liked, setLiked] = useState(false);

    // Auto-hide chrome after 3s
    useEffect(() => {
        if (!chromeVisible) return;
        const t = setTimeout(() => setChromeVisible(false), 3000);
        return () => clearTimeout(t);
    }, [chromeVisible]);

    const toggleChrome = useCallback(() => setChromeVisible((v) => !v), []);

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "#000", display: "flex", flexDirection: "column",
                userSelect: "none",
            }}
            onClick={toggleChrome}
        >
            {/* Top bar */}
            <div
                style={{
                    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.75rem 1rem",
                    paddingTop: "max(0.75rem, env(safe-area-inset-top))",
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
                    opacity: chromeVisible ? 1 : 0,
                    transition: "opacity 250ms ease",
                    pointerEvents: chromeVisible ? "auto" : "none",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="btn btn-icon"
                    style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", backdropFilter: "blur(12px)" }}
                    onClick={() => router.back()}
                    aria-label="Back"
                >
                    <ArrowLeft size={20} strokeWidth={2} />
                </button>
                <button
                    className="btn btn-icon"
                    style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", backdropFilter: "blur(12px)" }}
                    aria-label="More options"
                >
                    <MoreVertical size={20} strokeWidth={2} />
                </button>
            </div>

            {/* Photo area */}
            <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
            }}>
                <div style={{
                    width: "85%", maxWidth: 500, aspectRatio: "3/4",
                    borderRadius: "var(--r-sm)",
                    background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.2)", fontSize: "0.9rem", fontWeight: 600,
                }}>
                    Photo {params.id}
                </div>
            </div>

            {/* Date line */}
            <div
                style={{
                    textAlign: "center", padding: "0.5rem",
                    color: "rgba(255,255,255,0.55)", fontSize: "0.8rem",
                    opacity: chromeVisible ? 1 : 0,
                    transition: "opacity 250ms ease",
                }}
            >
                June 12, 2025 · 3:42 PM
            </div>

            {/* Bottom action bar */}
            <div
                style={{
                    display: "flex", justifyContent: "center", gap: "1.5rem",
                    padding: "0.75rem 1rem",
                    paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
                    background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                    opacity: chromeVisible ? 1 : 0,
                    transition: "opacity 250ms ease",
                    pointerEvents: chromeVisible ? "auto" : "none",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="btn btn-icon"
                    style={{
                        background: "rgba(255,255,255,0.12)", border: "none",
                        color: liked ? "#FF6B6B" : "#fff", backdropFilter: "blur(12px)"
                    }}
                    onClick={() => setLiked(!liked)}
                    aria-label="Like"
                >
                    <Heart size={20} strokeWidth={2} fill={liked ? "currentColor" : "none"} />
                </button>
                <button
                    className="btn btn-icon"
                    style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", backdropFilter: "blur(12px)" }}
                    onClick={() => router.push(`/edit/${params.id}`)}
                    aria-label="Edit"
                >
                    <Pencil size={20} strokeWidth={2} />
                </button>
                <button
                    className="btn btn-icon"
                    style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", backdropFilter: "blur(12px)" }}
                    aria-label="Share"
                >
                    <Share2 size={20} strokeWidth={2} />
                </button>
                <button
                    className="btn btn-icon"
                    style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", backdropFilter: "blur(12px)" }}
                    aria-label="Delete"
                >
                    <Trash2 size={20} strokeWidth={2} />
                </button>
            </div>

            {/* Swipe up hint */}
            <button
                style={{
                    position: "absolute", bottom: 70, left: "50%", transform: "translateX(-50%)",
                    background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
                    border: "none", color: "rgba(255,255,255,0.5)", borderRadius: "var(--r-pill)",
                    padding: "0.35rem 0.75rem", fontSize: "0.72rem", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.3rem",
                    opacity: chromeVisible ? 1 : 0, transition: "opacity 250ms ease",
                }}
                onClick={(e) => { e.stopPropagation(); setDetailsOpen(true); }}
            >
                <ChevronUp size={12} /> Details
            </button>

            {/* Details Panel */}
            {detailsOpen && (
                <div
                    style={{
                        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
                        background: "rgba(28,28,30,0.95)",
                        backdropFilter: "blur(40px) saturate(200%)",
                        borderRadius: "var(--r-lg) var(--r-lg) 0 0",
                        padding: "1.25rem",
                        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
                        animation: "slide-up-sheet 300ms ease",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{
                        width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)",
                        margin: "0 auto 1rem"
                    }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", color: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                            <MapPin size={16} strokeWidth={2} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: "0.88rem" }}>Ahmedabad, Gujarat</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                            <CameraIcon size={16} strokeWidth={2} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: "0.88rem" }}>Shot on iPhone 16 · f/1.8 · 1/120s</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                            <Maximize size={16} strokeWidth={2} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: "0.88rem" }}>4032 × 3024 · 3.2 MB</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                            <Users size={16} strokeWidth={2} color="rgba(255,255,255,0.5)" />
                            <span style={{ fontSize: "0.88rem" }}>2 people detected</span>
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", marginTop: "1rem", color: "rgba(255,255,255,0.6)" }}
                        onClick={() => setDetailsOpen(false)}
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}
