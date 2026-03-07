"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    HardDrive,
    Trash2,
    Palette,
    Sun,
    Moon,
    Monitor,
    LogOut,
    ChevronRight,
    Heart,
    Camera,
    Loader,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { ACCENT_PALETTES } from "@/lib/palettes";
import { useAuth } from "@/components/AuthContext";
import { uploadToR2 } from "@/lib/upload-utils";

const STORAGE_CAP_BYTES = 15 * 1024 * 1024 * 1024;

type SettingRowProps = { icon: ReactNode; label: string; right?: ReactNode; onClick?: () => void };
function SettingRow({ icon, label, right, onClick }: SettingRowProps) {
    const Component = onClick ? "button" : "div";
    return (
        <Component
            className="setting-row"
            onClick={onClick}
            type={onClick ? "button" : undefined}
            style={!onClick ? { cursor: 'default' } : undefined}
        >
            <span className="setting-row-icon">{icon}</span>
            <span className="setting-row-label">{label}</span>
            <span className="setting-row-right">{right ?? <ChevronRight size={16} color="var(--muted-2)" />}</span>
        </Component>
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
    const { user, signOut, updateUser } = useAuth();
    const { theme, setTheme, resolved, accentIndex, setAccentIndex } = useTheme();
    const [stats, setStats] = useState<Stats | null>(null);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => { });
    }, []);

    const usedPct = stats ? Math.min((stats.totalBytes / STORAGE_CAP_BYTES) * 100, 100) : 0;
    const availableBytes = stats ? Math.max(STORAGE_CAP_BYTES - stats.totalBytes, 0) : 0;

    const getInitials = (name?: string) => {
        const fallback = "U";
        if (!name?.trim()) return fallback;
        return name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || fallback;
    };

    const toAvatarBlob = async (file: File): Promise<Blob> => {
        const size = 320;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to initialize avatar canvas");

        if (typeof createImageBitmap === "function") {
            const bitmap = await createImageBitmap(file);
            const srcSize = Math.min(bitmap.width, bitmap.height);
            const sx = (bitmap.width - srcSize) / 2;
            const sy = (bitmap.height - srcSize) / 2;
            ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, size, size);
            bitmap.close();
        } else {
            const fileUrl = URL.createObjectURL(file);
            await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
                    const sx = (img.naturalWidth - srcSize) / 2;
                    const sy = (img.naturalHeight - srcSize) / 2;
                    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
                    URL.revokeObjectURL(fileUrl);
                    resolve();
                };
                img.onerror = () => {
                    URL.revokeObjectURL(fileUrl);
                    reject(new Error("Failed to load image"));
                };
                img.src = fileUrl;
            });
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => {
                    if (result) resolve(result);
                    else reject(new Error("Failed to export avatar"));
                },
                "image/webp",
                0.85,
            );
        });

        return blob;
    };

    const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setSavingAvatar(true);
            setAvatarError(null);

            if (!file.type.startsWith("image/")) {
                throw new Error("Please select a valid image file.");
            }

            const avatarBlob = await toAvatarBlob(file);
            const avatarFile = new File([avatarBlob], "avatar.webp", { type: "image/webp" });

            const presignRes = await fetch("/api/profile/avatar/presign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentType: avatarFile.type }),
            });
            const presignData = await presignRes.json();
            if (!presignRes.ok) {
                throw new Error(presignData?.error || "Failed to initialize avatar upload.");
            }

            await uploadToR2(avatarFile, String(presignData.uploadUrl), () => { });
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatarKey: presignData.avatarKey }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to save profile picture.");
            }

            updateUser({ avatar_url: data.user?.avatar_url });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update profile picture.";
            setAvatarError(message);
        } finally {
            setSavingAvatar(false);
            event.target.value = "";
        }
    };

    return (
        <div className="page-shell settings-shell">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
                <button className="btn btn-icon btn-secondary mobile-only" onClick={() => router.back()} aria-label="Back">
                    <ArrowLeft size={18} strokeWidth={2} />
                </button>
                <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700 }}>
                    Settings
                </h1>
            </div>

            <div className="settings-layout">
                <div className="settings-main-column">
                    <div className="panel settings-account-panel">
                        <div className="settings-avatar-wrap">
                            {user?.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    alt="Profile"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                            ) : (
                                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                                    {getInitials(user?.full_name)}
                                </span>
                            )}
                            <button
                                type="button"
                                className="settings-avatar-edit"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={savingAvatar}
                                aria-label="Change profile picture"
                            >
                                {savingAvatar ? <Loader size={14} className="spin" /> : <Camera size={14} />}
                            </button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>{user?.full_name || "Guest User"}</p>
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
                            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.3rem" }}>
                                {stats ? `${formatBytes(stats.totalBytes)} used • ${formatBytes(availableBytes)} available` : "—"}
                            </p>
                        </div>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handleAvatarChange}
                        />
                    </div>
                    {avatarError && (
                        <p style={{ marginTop: "0.65rem", color: "var(--error)", fontSize: "0.8rem" }}>{avatarError}</p>
                    )}

                    <div className="settings-storage-chips">
                        <div className="settings-storage-chip">
                            <span className="settings-storage-chip-label">Used</span>
                            <span className="settings-storage-chip-value">{stats ? formatBytes(stats.totalBytes) : "—"}</span>
                        </div>
                        <div className="settings-storage-chip">
                            <span className="settings-storage-chip-label">Available</span>
                            <span className="settings-storage-chip-value">{stats ? formatBytes(availableBytes) : "—"}</span>
                        </div>
                        <div className="settings-storage-chip">
                            <span className="settings-storage-chip-label">Capacity</span>
                            <span className="settings-storage-chip-value">{formatBytes(STORAGE_CAP_BYTES)}</span>
                        </div>
                    </div>

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
                            <SettingRow icon={<HardDrive size={18} />} label="Used space"
                                right={<span className="setting-value">{stats ? formatBytes(stats.totalBytes) : "—"}</span>} />
                            <SettingRow icon={<HardDrive size={18} />} label="Available space"
                                right={<span className="setting-value">{stats ? formatBytes(availableBytes) : "—"}</span>} />
                            <SettingRow icon={<HardDrive size={18} />} label="Storage capacity"
                                right={<span className="setting-value">{formatBytes(STORAGE_CAP_BYTES)}</span>} />
                        </div>
                    </div>

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
                            <div style={{ padding: "1rem", paddingTop: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
                                    <Palette size={18} color="var(--muted)" />
                                    <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>Accent Color</span>
                                </div>
                                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", padding: "4px" }}>
                                    {ACCENT_PALETTES[resolved].map((palette, i) => (
                                        <button
                                            key={palette.name}
                                            onClick={() => setAccentIndex(i)}
                                            title={palette.name}
                                            style={{
                                                width: 32, height: 32, borderRadius: "50%",
                                                background: palette.accent,
                                                border: accentIndex === i ? "3px solid #fff" : "none",
                                                boxShadow: accentIndex === i ? `0 0 12px ${palette.accent}` : "none",
                                                cursor: "pointer",
                                                transition: "all 150ms ease",
                                                padding: 0
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-side-column">
                    <div className="panel" style={{ padding: "1.25rem" }}>
                        <p className="section-heading" style={{ marginBottom: "0.65rem" }}>Account</p>
                        <div style={{ fontSize: "0.92rem", color: "var(--ink-2)", lineHeight: 1.6 }}>
                            Signed in as <strong>{user?.full_name || "Guest User"}</strong>.
                        </div>
                    </div>

                    <button className="btn btn-danger" style={{ width: "100%", marginTop: "0.5rem", padding: '1rem' }}
                        onClick={async () => {
                            await signOut();
                            router.replace("/login");
                        }}>
                        <LogOut size={18} strokeWidth={2} /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
