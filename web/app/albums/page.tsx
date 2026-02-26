"use client";

import { useRouter } from "next/navigation";
import { Plus, Star, Lightbulb, Image } from "lucide-react";

const PLACEHOLDER_ALBUMS = [
    { name: "Trip to Goa", count: 48, color: "linear-gradient(135deg, #FF6B6B, #FF9A3C)" },
    { name: "Birthday 2024", count: 23, color: "linear-gradient(135deg, #FFD93D, #FF6B6B)" },
    { name: "Family", count: 120, color: "linear-gradient(135deg, #5B4EFF, #9D93FF)" },
    { name: "Work", count: 15, color: "linear-gradient(135deg, #10B981, #60C8FF)" },
];

export default function AlbumsPage() {
    const router = useRouter();

    return (
        <div className="page-shell">
            <div style={{ marginBottom: "1.5rem" }}>
                <h1 style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: "clamp(1.6rem, 5vw, 2.1rem)", fontWeight: 700,
                    letterSpacing: "-0.02em", lineHeight: 1.15,
                }}>
                    Albums
                </h1>
                <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.3rem" }}>
                    Browse and organise your photo collections
                </p>
            </div>

            {/* Favorites row */}
            <div style={{ marginBottom: "1.75rem" }}>
                <p className="section-heading" style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.65rem" }}>
                    <Star size={14} strokeWidth={2.5} color="var(--accent)" /> Favourites
                </p>
                <div style={{
                    display: "flex", gap: "0.65rem", overflowX: "auto", paddingBottom: "0.5rem",
                    msOverflowStyle: "none", scrollbarWidth: "none"
                }}>
                    {PLACEHOLDER_ALBUMS.slice(0, 3).map((a) => (
                        <div key={a.name} style={{ flexShrink: 0, width: 130 }}>
                            <div style={{
                                width: 130, height: 130, borderRadius: "var(--r-md)",
                                background: a.color,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", border: "1px solid var(--line)",
                                transition: "transform 140ms ease",
                            }}>
                                <Image size={28} strokeWidth={1.5} color="rgba(255,255,255,0.7)" />
                            </div>
                            <p style={{
                                fontSize: "0.82rem", fontWeight: 700, marginTop: "0.4rem",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                            }}>
                                {a.name}
                            </p>
                            <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{a.count} photos</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Albums grid */}
            <div style={{ marginBottom: "1.25rem" }}>
                <p className="section-heading" style={{ marginBottom: "0.65rem" }}>Your Albums</p>
                <div className="albums-grid">
                    {PLACEHOLDER_ALBUMS.map((album) => (
                        <div className="album-card" key={album.name}>
                            <div className="album-cover-placeholder" style={{ background: album.color }}>
                                <Image size={24} strokeWidth={1.5} color="rgba(255,255,255,0.6)" />
                            </div>
                            <div className="album-info">
                                <p className="album-name">{album.name}</p>
                                <p className="album-count">{album.count} photos</p>
                            </div>
                        </div>
                    ))}

                    <div className="album-card" style={{ cursor: "pointer" }}>
                        <div className="album-cover-placeholder"
                            style={{ background: "var(--accent-soft)", color: "var(--accent)", flexDirection: "column", gap: "0.25rem" }}>
                            <Plus size={24} strokeWidth={2} color="var(--accent)" />
                        </div>
                        <div className="album-info">
                            <p className="album-name" style={{ color: "var(--accent)" }}>New Album</p>
                            <p className="album-count">Create collection</p>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{
                display: "flex", gap: "0.65rem", padding: "0.85rem 1rem",
                background: "var(--accent-soft)", borderRadius: "var(--r-md)",
                border: "1px solid rgba(91,78,255,0.18)",
            }}>
                <Lightbulb size={18} strokeWidth={1.8} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: "0.82rem", color: "var(--ink-2)", lineHeight: 1.55 }}>
                    Albums are coming soon! For now, run face grouping from the
                    {" "}<button className="btn-ghost btn-sm" onClick={() => router.push("/upload")}
                        style={{
                            display: "inline", padding: "0 0.25rem", fontWeight: 700, border: "none",
                            background: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.82rem"
                        }}>
                        Upload tab
                    </button> to see your grouped faces.
                </p>
            </div>
        </div>
    );
}
