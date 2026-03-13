"use client";

import { Clock3, Play, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const MEMORIES = [
    { title: "3 years ago in Goa", date: "December 2022", count: 12, summary: "Beach sunsets, candid portraits, and travel details." },
    { title: "Birthday Party", date: "February 2024", count: 8, summary: "Cake, family shots, and close-up reactions." },
    { title: "Sunset Collection", date: "Last year", count: 15, summary: "Golden-hour frames grouped from multiple days." },
    { title: "Family Reunion", date: "June 2023", count: 24, summary: "Wide group photos, dinner clips, and portraits." },
];

export default function MemoriesPage() {
    const featured = MEMORIES[0];

    return (
        <div className="page-shell section-stack">
            <PageHeader
                title="Memories"
                kicker="Highlights"
                meta={
                    <>
                        <div className="page-meta-card">
                            <div className="page-meta-label">Featured</div>
                            <div className="page-meta-value">{featured.title}</div>
                            <div className="page-meta-sub">{featured.count} photos in this set</div>
                        </div>
                        <div className="page-meta-card">
                            <div className="page-meta-label">Focus</div>
                            <div className="page-meta-value">Story-first</div>
                            <div className="page-meta-sub">Bigger cover, clearer labels, less decorative chrome</div>
                        </div>
                    </>
                }
            />

            <div className="page-grid-2">
                <section className="panel stack-md">
                    <div className="action-row" style={{ justifyContent: "space-between" }}>
                        <div className="stack-sm">
                            <p className="section-heading">Featured memory</p>
                            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--ink)" }}>{featured.title}</h2>
                            <p className="muted-copy">{featured.date}</p>
                        </div>
                        <span className="info-chip">
                            <Sparkles size={14} />
                            {featured.date}
                        </span>
                    </div>

                    <div
                        className="glass"
                        style={{
                            borderRadius: "var(--r-lg)",
                            padding: "2rem",
                            minHeight: 300,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)",
                            color: "#fff",
                            boxShadow: "var(--shadow-depth)",
                        }}
                    >
                        <div style={{ width: 56, height: 56, borderRadius: "var(--r-pill)", background: "var(--accent)", display: "grid", placeItems: "center", marginBottom: "1rem" }}>
                            <Play size={24} fill="#fff" color="#fff" />
                        </div>
                        <p style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>{featured.title}</p>
                        <p style={{ marginTop: "0.5rem", fontSize: "1rem", color: "rgba(255,255,255,0.8)" }}>
                            {featured.date} · {featured.count} photos
                        </p>
                    </div>
                </section>

                {/* Detailed info hidden for minimalism */}
            </div>

            <section className="panel stack-md">
                <div className="stack-sm">
                    <p className="section-heading">More moments</p>
                    <p className="muted-copy">Recent groups.</p>
                </div>

                <div className="page-grid-3">
                    {MEMORIES.slice(1).map((memory) => (
                        <article key={memory.title} className="panel" style={{ padding: "1rem", minHeight: 220 }}>
                            <div className="stack-sm">
                                <span className="info-chip">{memory.date}</span>
                                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>{memory.title}</h3>
                                <p className="muted-copy">{memory.summary}</p>
                            </div>
                            <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
                                <p className="helper-copy">{memory.count} photos</p>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
