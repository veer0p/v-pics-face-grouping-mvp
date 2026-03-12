"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Play, ChevronRight } from "lucide-react";

const MEMORIES = [
    { title: "3 years ago in Goa", date: "Dec 2022", count: 12, gradient: "linear-gradient(135deg, #FF6B6B 0%, #FF9A3C 100%)" },
    { title: "Birthday Party", date: "Feb 2024", count: 8, gradient: "linear-gradient(135deg, #5B4EFF 0%, #9D93FF 100%)" },
    { title: "Sunset Collection", date: "Last year", count: 15, gradient: "linear-gradient(135deg, #FFD93D 0%, #FF6B6B 100%)" },
    { title: "Family Reunion", date: "Jun 2023", count: 24, gradient: "linear-gradient(135deg, #10B981 0%, #60C8FF 100%)" },
];

export default function MemoriesPage() {
    const router = useRouter();
    const featured = MEMORIES[0];

    return (
        <div className="page-shell">
            <div style={{ marginBottom: "2.5rem" }}>
                <h1 style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: "clamp(1.75rem, 5vw, 2.5rem)", fontWeight: 700,
                    letterSpacing: "-0.02em",
                }}>
                    <Sparkles size={28} strokeWidth={2} style={{ display: "inline", verticalAlign: "-5px", marginRight: 8 }} />
                    Memories
                </h1>
                <p style={{ marginTop: "0.55rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                    Curated highlights from your library. Tap any card to open the related moment.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Featured Memory */}
                    <div style={{
                        borderRadius: "var(--r-lg)", overflow: "hidden", background: featured.gradient,
                        aspectRatio: "16/10", maxHeight: 500, position: "relative", cursor: "pointer",
                    }}>
                        <div style={{
                            position: "absolute", inset: 0,
                            background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)",
                            display: "flex", flexDirection: "column", justifyContent: "flex-end",
                            padding: "2rem",
                        }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: "50%",
                                background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                marginBottom: "1rem",
                            }}>
                                <Play size={28} fill="#fff" color="#fff" />
                            </div>
                            <p style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
                                &ldquo;{featured.title}&rdquo;
                            </p>
                            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.95rem", marginTop: "0.4rem" }}>
                                {featured.date} · {featured.count} photos
                            </p>
                        </div>
                    </div>

                    {/* For You Today */}
                    <div>
                        <p className="section-heading" style={{ marginBottom: "1rem" }}>For You Today</p>
                        <div className="responsive-grid" style={{ gap: "1rem" }}>
                            {MEMORIES.slice(1, 4).map((m) => (
                                <div key={m.title} style={{
                                    borderRadius: "var(--r-md)", overflow: "hidden", background: m.gradient,
                                    aspectRatio: "4/5", position: "relative", cursor: "pointer",
                                }}>
                                    <div style={{
                                        position: "absolute", inset: 0,
                                        background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)",
                                        display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "1rem",
                                    }}>
                                        <Play size={20} fill="#fff" color="#fff" style={{ marginBottom: "0.5rem" }} />
                                        <p style={{ color: "#fff", fontSize: "1rem", fontWeight: 700 }}>&ldquo;{m.title}&rdquo;</p>
                                        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.82rem" }}>{m.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* This Month in Past Years */}
                    <div>
                        <p className="section-heading" style={{ marginBottom: "1rem" }}>This Month In Past Years</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
                            {MEMORIES.slice(2).map((m) => (
                                <div key={m.title} style={{
                                    borderRadius: "var(--r-md)", overflow: "hidden", background: m.gradient,
                                    aspectRatio: "21/9", position: "relative", cursor: "pointer",
                                }}>
                                    <div style={{
                                        position: "absolute", inset: 0,
                                        background: "linear-gradient(to right, rgba(0,0,0,0.7) 0%, transparent 100%)",
                                        display: "flex", flexDirection: "column", justifyContent: "center", padding: "1.5rem",
                                    }}>
                                        <p style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 700 }}>&ldquo;{m.title}&rdquo;</p>
                                        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.9rem" }}>{m.date} · {m.count} photos</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
