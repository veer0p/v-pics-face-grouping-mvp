"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, HardDrive, Loader, LogOut, Monitor, Moon, Save, Sun, Trash2, Upload } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthContext";

type StatsResponse = {
  totalPhotos: number;
  totalBytes: number;
  trashCount: number;
  trashBytes: number;
  favoriteCount: number;
  imageCount?: number;
  videoCount?: number;
  storage?: {
    diskSizeRaw: number;
    diskUseRaw: number;
    diskAvailableRaw: number;
    diskUsagePercentage: number;
  };
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(user?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(user?.full_name || "");
  }, [user?.full_name]);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await fetch("/api/stats");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data?.error || "Failed to load stats"));
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setStatsError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveName = async () => {
    if (savingName) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setProfileMessage("Name cannot be empty.");
      return;
    }
    if (trimmed === (user?.full_name || "").trim()) {
      setProfileMessage("Name is already up to date.");
      return;
    }

    setSavingName(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to update profile"));
      if (data?.user?.full_name) {
        updateUser({ full_name: data.user.full_name });
        setNameDraft(data.user.full_name);
        setProfileMessage("Profile name updated.");
      }
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingName(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (avatarUploading) return;
    if (!file.type.startsWith("image/")) {
      setProfileMessage("Please select an image file.");
      return;
    }
    setAvatarUploading(true);
    setProfileMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to upload profile image"));
      if (data?.user?.avatar_url) {
        updateUser({ avatar_url: data.user.avatar_url });
      }
      setProfileMessage("Profile photo updated.");
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : "Failed to upload profile photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (avatarUploading) return;
    setAvatarUploading(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to remove profile image"));
      updateUser({ avatar_url: undefined });
      setProfileMessage("Profile photo removed.");
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : "Failed to remove profile photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="page-shell settings-shell">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.2rem" }}>
        <button className="btn btn-icon btn-secondary mobile-only" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 700,
          }}
        >
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
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>
                  {(user?.full_name || "U").slice(0, 1).toUpperCase()}
                </span>
              )}
              <button
                type="button"
                className="settings-avatar-edit"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label="Change profile picture"
              >
                {avatarUploading ? <Loader size={12} className="spin" /> : <Camera size={12} />}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const next = event.target.files?.[0];
                  if (next) void uploadAvatar(next);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div style={{ flex: 1, display: "grid", gap: "0.45rem" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Profile
              </p>
              <input className="input" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>
                  <Upload size={14} />
                  Change Photo
                </button>
                <button className="btn btn-ghost btn-sm" onClick={removeAvatar} disabled={avatarUploading || !user?.avatar_url}>
                  Remove Photo
                </button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Username/PIN login remains managed in Supabase auth tables.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveName} disabled={savingName}>
              {savingName ? <Loader size={14} className="spin" /> : <Save size={14} />}
              Save
            </button>
          </div>

          {profileMessage && (
            <div className="panel" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>
              {profileMessage}
            </div>
          )}

          <div className="panel">
            <p className="section-heading" style={{ marginBottom: "0.85rem" }}>Theme</p>
            <div className="theme-selector">
              <button
                className={`theme-selector-btn${theme === "light" ? " active" : ""}`}
                onClick={() => setTheme("light")}
              >
                <Sun size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Light
              </button>
              <button
                className={`theme-selector-btn${theme === "system" ? " active" : ""}`}
                onClick={() => setTheme("system")}
              >
                <Monitor size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> System
              </button>
              <button
                className={`theme-selector-btn${theme === "dark" ? " active" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <Moon size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Dark
              </button>
            </div>
          </div>

          {statsError && (
            <div className="panel" style={{ borderColor: "var(--error)", color: "var(--error)" }}>
              {statsError}
            </div>
          )}

          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <p className="section-heading">Library Stats</p>
              {statsLoading && <Loader size={14} className="spin" color="var(--accent)" />}
            </div>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-card-value">{stats?.totalPhotos || 0}</div>
                <div className="stat-card-label">Assets</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-value">{stats?.favoriteCount || 0}</div>
                <div className="stat-card-label">Favorites</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-value">{stats?.trashCount || 0}</div>
                <div className="stat-card-label">In Trash</div>
              </div>
            </div>

            <div className="settings-storage-chips">
              <div className="settings-storage-chip">
                <span className="settings-storage-chip-label">Library Usage</span>
                <span className="settings-storage-chip-value">{formatBytes(Number(stats?.totalBytes || 0))}</span>
              </div>
              <div className="settings-storage-chip">
                <span className="settings-storage-chip-label">Trash Size</span>
                <span className="settings-storage-chip-value">{formatBytes(Number(stats?.trashBytes || 0))}</span>
              </div>
              <div className="settings-storage-chip">
                <span className="settings-storage-chip-label">Disk Used</span>
                <span className="settings-storage-chip-value">{formatBytes(Number(stats?.storage?.diskUseRaw || 0))}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-side-column">
          <div className="panel">
            <p className="section-heading" style={{ marginBottom: "0.75rem" }}>Maintenance</p>
            <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "flex-start", marginBottom: "0.6rem" }} onClick={() => router.push("/trash")}>
              <Trash2 size={16} />
              Open Trash Manager
            </button>
            <div style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.5, display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <HardDrive size={13} />
              Trash and storage now map to Immich directly.
            </div>
          </div>

          <button
            className="btn btn-danger"
            style={{ width: "100%", padding: "1rem" }}
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            <LogOut size={18} strokeWidth={2} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
