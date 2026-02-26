"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    X, Check, Wand2, Crop, SlidersHorizontal,
    Palette, PenTool, Sun, Contrast, Droplets, Thermometer, Focus,
} from "lucide-react";

const TABS = [
    { key: "auto", label: "Auto", Icon: Wand2 },
    { key: "crop", label: "Crop", Icon: Crop },
    { key: "adjust", label: "Adjust", Icon: SlidersHorizontal },
    { key: "filter", label: "Filter", Icon: Palette },
    { key: "markup", label: "Markup", Icon: PenTool },
];

const SLIDERS = [
    { key: "brightness", label: "Brightness", Icon: Sun, default: 50 },
    { key: "contrast", label: "Contrast", Icon: Contrast, default: 50 },
    { key: "saturation", label: "Saturation", Icon: Droplets, default: 50 },
    { key: "warmth", label: "Warmth", Icon: Thermometer, default: 50 },
    { key: "sharpness", label: "Sharpness", Icon: Focus, default: 30 },
];

const FILTERS = ["None", "Vivid", "Warm", "Cool", "Fade", "Mono"];

export default function EditorPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const [tab, setTab] = useState("adjust");
    const [values, setValues] = useState<Record<string, number>>(
        Object.fromEntries(SLIDERS.map((s) => [s.key, s.default]))
    );
    const [activeFilter, setActiveFilter] = useState("None");

    const updateSlider = (key: string, val: number) => setValues((p) => ({ ...p, [key]: val }));

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100vh",
            background: "var(--bg)", overflow: "hidden",
        }}>
            {/* Toolbar */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.75rem 1rem", paddingTop: "max(0.75rem, env(safe-area-inset-top))",
                borderBottom: "1px solid var(--line)",
            }}>
                <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>
                    <X size={16} strokeWidth={2.5} /> Cancel
                </button>
                <button className="btn btn-primary btn-sm">
                    <Check size={16} strokeWidth={2.5} /> Save Copy
                </button>
            </div>

            {/* Preview Area (65% height) */}
            <div style={{
                flex: "0 0 60vh", display: "flex", alignItems: "center", justifyContent: "center",
                background: "#000", overflow: "hidden",
            }}>
                <div style={{
                    width: "70%", maxWidth: 400, aspectRatio: "3/4", borderRadius: "var(--r-md)",
                    background: "linear-gradient(135deg, #2a2a3e, #1a1a2e)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.3)", fontSize: "0.85rem", fontWeight: 600,
                    filter: `brightness(${values.brightness / 50}) contrast(${values.contrast / 50}) saturate(${values.saturation / 50})`,
                    transition: "filter 150ms ease",
                }}>
                    LIVE PREVIEW
                </div>
            </div>

            {/* Tab Row */}
            <div style={{
                display: "flex", gap: "0.15rem", padding: "0.35rem 0.5rem",
                borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
                background: "var(--bg-subtle)", overflowX: "auto",
            }}>
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        className={`chip${tab === t.key ? " active" : ""}`}
                        onClick={() => setTab(t.key)}
                        style={{ gap: "0.3rem" }}
                    >
                        <t.Icon size={14} strokeWidth={2} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Controls Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                {tab === "auto" && (
                    <div className="empty-state" style={{ minHeight: 120, padding: "1rem" }}>
                        <Wand2 size={28} strokeWidth={1.5} color="var(--accent)" />
                        <p style={{ fontSize: "0.88rem", fontWeight: 600 }}>One-tap auto-enhance</p>
                        <button className="btn btn-primary btn-sm" onClick={() => setTab("adjust")}>
                            <Wand2 size={14} /> Apply Auto
                        </button>
                    </div>
                )}

                {tab === "adjust" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {SLIDERS.map((s) => (
                            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <s.Icon size={16} color="var(--muted)" />
                                <label style={{ minWidth: 80, fontSize: "0.85rem", fontWeight: 600 }}>{s.label}</label>
                                <input
                                    type="range" min="0" max="100" value={values[s.key]}
                                    onChange={(e) => updateSlider(s.key, Number(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span style={{ fontSize: "0.78rem", color: "var(--muted)", minWidth: 24, textAlign: "right" }}>
                                    {values[s.key]}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {tab === "filter" && (
                    <div style={{ display: "flex", gap: "0.65rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                style={{
                                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem",
                                    cursor: "pointer", background: "none", border: "none", fontFamily: "var(--font-ui)",
                                }}
                            >
                                <div style={{
                                    width: 56, height: 56, borderRadius: "var(--r-sm)",
                                    background: `linear-gradient(135deg, ${f === "Warm" ? "#FFD93D,#FF6B6B" : f === "Cool" ? "#60C8FF,#5B4EFF" : f === "Vivid" ? "#FF6B6B,#FFD93D,#10B981" : f === "Fade" ? "#ddd,#aaa" : f === "Mono" ? "#333,#888" : "var(--bg-subtle),var(--line)"})`,
                                    border: activeFilter === f ? "2px solid var(--accent)" : "2px solid transparent",
                                    transition: "border-color 150ms",
                                }} />
                                <span style={{ fontSize: "0.72rem", fontWeight: activeFilter === f ? 700 : 500, color: activeFilter === f ? "var(--accent)" : "var(--muted)" }}>
                                    {f}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {(tab === "crop" || tab === "markup") && (
                    <div className="empty-state" style={{ minHeight: 120, padding: "1rem" }}>
                        <p style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
                            {tab === "crop" ? "Crop & rotate tools" : "Draw & annotate tools"} — coming soon
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
