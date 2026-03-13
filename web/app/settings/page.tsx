"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, HardDrive, Loader, LogOut, Monitor, Moon, Save, Sun, Trash2, Upload } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthContext";
import { useHeaderSyncAction } from "@/components/HeaderSyncContext";
import { UserAvatar } from "@/components/UserAvatar";
import { navigateBackOr } from "@/lib/navigation";

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

const MAX_AVATAR_INPUT_SIZE = 25 * 1024 * 1024;
const MAX_AVATAR_UPLOAD_SIZE = 8 * 1024 * 1024;

let settingsStatsSnapshot: StatsResponse | null = null;

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const blobUrl = URL.createObjectURL(file);
  const img = new Image();
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode selected image"));
  });
  img.src = blobUrl;
  try {
    return await loaded;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function prepareAvatarFile(file: File): Promise<File> {
  const source = await loadImageElement(file);
  const side = Math.min(source.naturalWidth, source.naturalHeight);
  const sx = Math.max(0, Math.floor((source.naturalWidth - side) / 2));
  const sy = Math.max(0, Math.floor((source.naturalHeight - side) / 2));
  const outSize = 512;

  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available for avatar processing");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, side, side, 0, 0, outSize, outSize);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("Failed to prepare avatar image"));
        return;
      }
      resolve(nextBlob);
    }, "image/webp", 0.92);
  });

  return new File([blob], `avatar-${Date.now()}.webp`, { type: "image/webp" });
}

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
  const [stats, setStats] = useState<StatsResponse | null>(() => settingsStatsSnapshot);
  const [statsLoading, setStatsLoading] = useState(() => !settingsStatsSnapshot);
  const [syncingStats, setSyncingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(user?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(user?.full_name || "");
  }, [user?.full_name]);

  const loadStats = useCallback(async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;
    if (!silent) {
      setStatsLoading(!settingsStatsSnapshot);
      setSyncingStats(true);
    }
    setStatsError(null);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load stats"));
      settingsStatsSnapshot = data;
      setStats(data);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setStatsLoading(false);
      setSyncingStats(false);
    }
  }, []);

  useEffect(() => {
    void loadStats({ silent: !!settingsStatsSnapshot });
  }, [loadStats]);

  useHeaderSyncAction({
    label: "Sync",
    loading: syncingStats,
    onClick: () => {
      void loadStats();
    },
    ariaLabel: "Sync settings data",
    onBack: () => navigateBackOr(router, "/"),
  });

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
    if (file.size > MAX_AVATAR_INPUT_SIZE) {
      setProfileMessage("Selected image is too large. Please choose a file under 25MB.");
      return;
    }
    setAvatarUploading(true);
    setProfileMessage(null);
    try {
      const processedFile = await prepareAvatarFile(file);
      if (processedFile.size > MAX_AVATAR_UPLOAD_SIZE) {
        setProfileMessage("Avatar is still too large after compression. Try a smaller image.");
        return;
      }
      const form = new FormData();
      form.append("file", processedFile);
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
      updateUser({ avatar_url: null });
      setProfileMessage("Profile photo removed.");
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : "Failed to remove profile photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="page-shell settings-shell">

      {syncingStats && stats && (
        <div className="status-banner success" style={{ marginBottom: "0.85rem", color: "var(--ink-2)" }}>
          Pulling the latest profile and library stats.
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-main-column">
          <div className="glass settings-account-panel" style={{ padding: '2rem', borderRadius: 'var(--r-lg)', marginBottom: '1.5rem' }}>
            <div className="settings-avatar-wrap">
              <UserAvatar
                src={user?.avatar_url}
                name={user?.full_name || user?.username || "User"}
                size={96}
                style={{ width: "100%", height: "100%" }}
              />
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
            <div className="settings-profile-main">
              <div className="settings-profile-head">
                <div style={{ minWidth: 0 }}>
                  <p className="section-heading" style={{ marginBottom: "0.4rem" }}>Profile</p>
                  <div className="settings-profile-name">{user?.full_name || user?.username || "User"}</div>
                  {user?.username && <div className="info-chip" style={{ width: "fit-content", marginTop: "0.45rem" }}>@{user.username}</div>}
                </div>
                <div className="settings-profile-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>
                    <Upload size={14} />
                    Change Photo
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={removeAvatar} disabled={avatarUploading || !user?.avatar_url}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="settings-profile-edit-row">
                <input className="input" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Display name" />
                <button className="btn btn-primary btn-sm" onClick={saveName} disabled={savingName}>
                  {savingName ? <Loader size={14} className="spin" /> : <Save size={14} />}
                  Save
                </button>
              </div>

              <div className="theme-selector settings-theme-inline">
                <button
                  className={`theme-selector-btn${theme === "light" ? " active" : ""}`}
                  onClick={() => setTheme("light")}
                >
                  <Sun size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Luxury Cute
                </button>
                <button
                  className={`theme-selector-btn${theme === "system" ? " active" : ""}`}
                  onClick={() => setTheme("system")}
                >
                  <Monitor size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Auto
                </button>
                <button
                  className={`theme-selector-btn${theme === "dark" ? " active" : ""}`}
                  onClick={() => setTheme("dark")}
                >
                  <Moon size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Night
                </button>
              </div>
            </div>
          </div>

          {profileMessage && (
            <div className="status-banner success" style={{ color: "var(--ink-2)" }}>
              {profileMessage}
            </div>
          )}

          {statsError && (
            <div className="status-banner error">
              {statsError}
            </div>
          )}

          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--r-lg)', marginBottom: '1.5rem' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <p className="section-heading">Library</p>
              {(statsLoading || syncingStats) && <Loader size={14} className="spin" color="var(--accent)" />}
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
          <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--r-lg)', marginBottom: '1.5rem' }}>
            <p className="section-heading" style={{ marginBottom: "0.75rem" }}>Quick actions</p>
            <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "flex-start", marginBottom: "0.6rem" }} onClick={() => router.push("/trash")}>
              <Trash2 size={16} />
              Open Trash
            </button>
            <div style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.4, display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <HardDrive size={13} />
              Storage usage is synced from Immich.
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
