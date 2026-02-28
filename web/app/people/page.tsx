"use client";

import { useRouter } from "next/navigation";
import { Users, Upload, Lightbulb } from "lucide-react";

export default function PeoplePage() {
    const router = useRouter();

    return (
        <div className="page-shell">
            <div style={{ marginBottom: "2.5rem" }}>
                <h1 style={{
                    fontFamily: "var(--font-display)", fontStyle: "italic",
                    fontSize: "clamp(1.75rem, 5vw, 2.5rem)", fontWeight: 700,
                    letterSpacing: "-0.02em", lineHeight: 1.1,
                }}>
                    People
                </h1>
                <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginTop: "0.5rem" }}>
                    Faces grouped by person across all your uploads
                </p>
            </div>

            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                <div className="empty-state">
                    <div style={{
                        width: 64, height: 64, borderRadius: "var(--r-lg)",
                        background: "var(--accent-soft)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <Users size={28} strokeWidth={1.5} color="var(--accent)" />
                    </div>
                    <p className="empty-state-title">No people yet</p>
                    <p className="empty-state-sub">
                        Upload a batch of photos and run face grouping to see people appear here.
                    </p>
                    <button className="btn btn-primary" onClick={() => router.push("/upload")}>
                        <Upload size={16} strokeWidth={2.5} /> Upload Photos
                    </button>
                </div>
            </div>

            <div style={{
                marginTop: "1.25rem", display: "flex", gap: "0.65rem",
                padding: "0.85rem 1rem", background: "var(--accent-soft)",
                borderRadius: "var(--r-md)", border: "1px solid rgba(91,78,255,0.18)",
            }}>
                <Lightbulb size={18} strokeWidth={1.8} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: "0.82rem", color: "var(--ink-2)", lineHeight: 1.55 }}>
                    After grouping, you can give names to each person cluster. They&apos;ll appear here
                    for easy browsing across all your uploads.
                </p>
            </div>
        </div>
    );
}
