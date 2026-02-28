"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, User, HardDrive, Trash2, Image, Palette,
    Sun, Moon, Monitor, Grid3X3, ScanFace, MapPin, Info, Shield, LogOut,
    ChevronRight, Heart,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

type ToggleProps = { on: boolean; onChange: (v: boolean) => void };
function Toggle({ on, onChange }: ToggleProps) {
    return (
        <button className="settings-toggle" role="switch" aria-checked={on}
            onClick={() => onChange(!on)}>
            <span className={`settings-toggle-track${on ? " on" : ""}`}>
                <span className="settings-toggle-thumb" />
            </span>
        </button>
    );
}

type SettingRowProps = { icon: React.ReactNode; label: string; right?: React.ReactNode; onClick?: () => void };
function SettingRow({ icon, label, right, onClick }: SettingRowProps) {
    return (
        <button className="setting-row" onClick={onClick} type="button">
            <span className="setting-row-icon">{icon}</span>
            <span className="setting-row-label">{label}</span>
            <span className="setting-row-right">{right ?? <ChevronRight size={16} color="var(--muted-2)" />}</span>
        </button>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type Stats = { totalPhotos: number; totalBytes: number; trashCount: number; trashBytes: number; favoriteCount: number };

export default function SettingsPage() {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [faceRecog, setFaceRecog] = useState(true);
    const [locationOn, setLocationOn] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => { });
    }, []);

    const usedPct = stats ? Math.min((stats.totalBytes / (15 * 1024 * 1024 * 1024)) * 100, 100) : 0;

    return (
        <div className="page-shell">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
                <button className="btn btn-icon btn-secondary mobile-only" onClick={() => router.back()} aria-label="Back">
                    <ArrowLeft size={18} strokeWidth={2} />
                </button>
                <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700 }}>
                    Settings
                </h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Account Card with real storage stats */}
                    <div className="panel" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: '1.5rem' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: "var(--r-pill)",
                            background: "conic-gradient(from 120deg, #5B4EFF, #FF6B6B, #FFD93D, #5B4EFF)",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                            <User size={28} color="#fff" strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>Guest User</p>
                            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                                {stats ? `${stats.totalPhotos} photos • ${stats.favoriteCount} favorites` : "Loading…"}
                            </p>
                            <div style={{ marginTop: "0.6rem", height: 8, borderRadius: 4, background: "var(--bg-subtle)", overflow: "hidden" }}>
                                <div style={{
                                    height: "100%", width: `${usedPct}%`, borderRadius: 4,
                                    background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                                    transition: "width 500ms ease",
                                }} />
                            </div>
                            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                                {stats ? `${formatBytes(stats.totalBytes)} / 15 GB used` : "—"}
                            </p>
                        </div>
                    </div>

                    {/* Storage */}
                    <div>
                        <p className="section-heading" style={{ marginBottom: "0.75rem" }}>Storage</p>
                        <div className="settings-group">
                            <SettingRow icon={<HardDrive size={18} />} label="Total photos"
                                right={<span className="setting-value">{stats?.totalPhotos ?? "—"}</span>} />
                            <SettingRow icon={<Heart size={18} />} label="Favorites"
                                right={<span className="setting-value">{stats?.favoriteCount ?? "—"}</span>} />
                            <SettingRow icon={<Trash2 size={18} />} label="Trash"
                                right={<span className="setting-value">{stats ? `${stats.trashCount} (${formatBytes(stats.trashBytes)})` : "—"}</span>}
                                onClick={() => router.push("/trash")} />
                        </div>
                    </div>

                    {/* Appearance */}
                    <div>
                        <p className="section-heading" style={{ marginBottom: "0.75rem" }}>Appearance</p>
                        <div className="settings-group">
                            <div style={{ padding: "1rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
                                    <Sun size={18} color="var(--muted)" />
                                    <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>Theme</span>
                                </div>
                                <div className="theme-selector">
                                    <button className={`theme-selector-btn${theme === "light" ? " active" : ""}`}
                                        onClick={() => setTheme("light")}>
                                        <Sun size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Light
                                    </button>
                                    <button className={`theme-selector-btn${theme === "system" ? " active" : ""}`}
                                        onClick={() => setTheme("system")}>
                                        <Monitor size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> System
                                    </button>
                                    <button className={`theme-selector-btn${theme === "dark" ? " active" : ""}`}
                                        onClick={() => setTheme("dark")}>
                                        <Moon size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Dark
                                    </button>
                                </div>
                            </div>
                            <SettingRow icon={<Palette size={18} />} label="Accent color" right={
                                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent)" }} />
                            } />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Privacy */}
                    <div>
                        <p className="section-heading" style={{ marginBottom: "0.75rem" }}>Privacy</p>
                        <div className="settings-group">
                            <SettingRow icon={<ScanFace size={18} />} label="Face recognition"
                                right={<Toggle on={faceRecog} onChange={setFaceRecog} />} />
                            <SettingRow icon={<MapPin size={18} />} label="Location in photos"
                                right={<Toggle on={locationOn} onChange={setLocationOn} />} />
                        </div>
                    </div>

                    {/* About */}
                    <div>
                        <p className="section-heading" style={{ marginBottom: "0.75rem" }}>About</p>
                        <div className="settings-group">
                            <SettingRow icon={<Info size={18} />} label="App version"
                                right={<span className="setting-value">1.0.0-mvp</span>} />
                            <SettingRow icon={<Shield size={18} />} label="Privacy policy" />
                        </div>
                    </div>

                    <button className="btn btn-danger" style={{ width: "100%", marginTop: "1rem", padding: '1rem' }}
                        onClick={() => { }}>
                        <LogOut size={18} strokeWidth={2} /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
