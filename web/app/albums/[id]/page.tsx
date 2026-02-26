"use client";

import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, MoreVertical, Plus, Image } from "lucide-react";

const ALBUM_DATA: Record<string, { name: string; count: number; gradient: string }> = {
    "1": { name: "Trip to Goa", count: 48, gradient: "linear-gradient(135deg, #FF6B6B, #FF9A3C)" },
    "2": { name: "Birthday 2024", count: 23, gradient: "linear-gradient(135deg, #FFD93D, #FF6B6B)" },
    "3": { name: "Family", count: 120, gradient: "linear-gradient(135deg, #5B4EFF, #9D93FF)" },
    "4": { name: "Work", count: 15, gradient: "linear-gradient(135deg, #10B981, #60C8FF)" },
};

export default function AlbumDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const album = ALBUM_DATA[params.id] ?? { name: "Album", count: 0, gradient: "linear-gradient(135deg, var(--bg-subtle), var(--line))" };

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
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{album.count} photos · Dec 2024</p>
                </div>
                <button className="btn btn-icon btn-secondary" aria-label="More options">
                    <MoreVertical size={18} strokeWidth={2} />
                </button>
            </div>

            {/* Hero cover */}
            <div style={{
                margin: "0 1rem", borderRadius: "var(--r-lg)", overflow: "hidden",
                aspectRatio: "16/9", background: album.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
            }}>
                <Image size={36} strokeWidth={1.5} color="rgba(255,255,255,0.5)" />
            </div>

            {/* Photo grid */}
            <div style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2,
                margin: "1rem 0", padding: "0 1rem",
            }}>
                {Array.from({ length: album.count > 16 ? 16 : album.count }, (_, i) => (
                    <div
                        key={i}
                        onClick={() => router.push(`/photo/${i + 1}`)}
                        style={{
                            aspectRatio: "1", borderRadius: "var(--r-sm)",
                            background: `hsl(${(i * 37) % 360}, 45%, ${35 + (i % 3) * 10}%)`,
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "transform 120ms",
                        }}
                    >
                        <Image size={14} strokeWidth={1.5} color="rgba(255,255,255,0.25)" />
                    </div>
                ))}
            </div>

            {album.count > 16 && (
                <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--muted)", padding: "0 1rem 1rem" }}>
                    + {album.count - 16} more photos
                </p>
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
                }}>
                    <Plus size={16} strokeWidth={2.5} /> Add Photos
                </button>
            </div>
        </div>
    );
}
