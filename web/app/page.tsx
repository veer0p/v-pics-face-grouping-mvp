"use client";
/* eslint-disable @next/next/no-img-element */

import { ImageIcon, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomePage() {
    const router = useRouter();

    return (
        <div className="page-shell" style={{ maxWidth: "100%", padding: "0" }}>
            {/* Empty state — photos grid will populate from API */}
            <div className="empty-state" style={{ minHeight: "calc(100vh - 180px)" }}>
                <div style={{
                    width: 80, height: 80, borderRadius: "var(--r-lg)",
                    background: "var(--accent-soft)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <ImageIcon size={36} strokeWidth={1.5} color="var(--accent)" />
                </div>
                <p className="empty-state-title">No photos yet</p>
                <p className="empty-state-sub">
                    Tap the button below to upload photos and group faces by person.
                </p>
                <button className="btn btn-primary" onClick={() => router.push("/upload")}>
                    <Plus size={18} strokeWidth={2.5} />
                    Upload Photos
                </button>
            </div>
        </div>
    );
}
