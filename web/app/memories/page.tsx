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
            <div style={{ marginBottom: "1.5rem" }}>
                <h1 style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: "clamp(1.6rem, 5vw, 2.1rem)", fontWeight: 700,
                    letterSpacing: "-0.02em",
                }}>
                    <Sparkles size={24} strokeWidth={2} style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
                    Memories
                </h1>
            </div>

            {/* Featured Memory */}
            <div style={{
                borderRadius: "var(--r-lg)", overflow: "hidden", background: featured.gradient,
                aspectRatio: "9/14", maxHeight: 380, position: "relative", cursor: "pointer",
                marginBottom: "1.5rem",
            }}>
                <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    padding: "1.25rem",
                }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: "50%",
                        background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: "0.85rem",
                    }}>
                        <Play size={22} fill="#fff" color="#fff" />
                    </div>
                    <p style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 700, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
                        &ldquo;{featured.title}&rdquo;
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                        {featured.date} · {featured.count} photos
                    </p>
                </div>
            </div>

            {/* For You Today */}
            <p className="section-heading" style={{ marginBottom: "0.65rem" }}>For You Today</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {MEMORIES.slice(1, 3).map((m) => (
                    <div key={m.title} style={{
                        borderRadius: "var(--r-md)", overflow: "hidden", background: m.gradient,
                        aspectRatio: "4/5", position: "relative", cursor: "pointer",
                    }}>
                        <div style={{
                            position: "absolute", inset: 0,
                            background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)",
                            display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0.75rem",
                        }}>
                            <Play size={16} fill="#fff" color="#fff" style={{ marginBottom: "0.4rem" }} />
                            <p style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>&ldquo;{m.title}&rdquo;</p>
                            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem" }}>{m.date}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* This Month in Past Years */}
            <p className="section-heading" style={{ marginBottom: "0.65rem" }}>This Month In Past Years</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {MEMORIES.slice(2).map((m) => (
                    <div key={m.title} style={{
                        borderRadius: "var(--r-md)", overflow: "hidden", background: m.gradient,
                        aspectRatio: "4/5", position: "relative", cursor: "pointer",
                    }}>
                        <div style={{
                            position: "absolute", inset: 0,
                            background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)",
                            display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0.75rem",
                        }}>
                            <p style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>&ldquo;{m.title}&rdquo;</p>
                            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem" }}>{m.date} · {m.count} photos</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
