"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader, Plus } from "lucide-react";
import { useHeaderSyncAction } from "@/components/HeaderSyncContext";
import { PageHeader } from "@/components/PageHeader";

type AlbumItem = {
  id: string;
  name: string;
  count: number;
  coverUrl: string | null;
  createdAt: string;
};

let albumsPageSnapshot: AlbumItem[] | null = null;

export default function AlbumsPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<AlbumItem[]>(() => albumsPageSnapshot || []);
  const [loading, setLoading] = useState(() => !albumsPageSnapshot);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadAlbums = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(!albumsPageSnapshot);
    setError(null);
    try {
      const res = await fetch("/api/albums", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load albums"));
      const nextAlbums = Array.isArray(data?.albums) ? data.albums : [];
      albumsPageSnapshot = nextAlbums;
      setAlbums(nextAlbums);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load albums");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlbums({ silent: !!albumsPageSnapshot });
  }, [loadAlbums]);

  const syncAlbums = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await loadAlbums({ silent: true });
    } finally {
      setSyncing(false);
    }
  }, [loadAlbums, syncing]);

  useHeaderSyncAction({
    label: "Sync",
    loading: syncing,
    onClick: () => {
      void syncAlbums();
    },
    ariaLabel: "Sync albums",
  });

  const createAlbum = async () => {
    if (creating) return;
    const trimmed = name.trim();
    const finalName = trimmed || `Album ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to create album"));
      setName("");
      await loadAlbums({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create album");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Albums"
        meta={
          <>
            <div className="page-meta-card">
              <div className="page-meta-label">Albums</div>
              <div className="page-meta-value">{albums.length}</div>
              <div className="page-meta-sub">Synced from your Immich account</div>
            </div>
            <div className="page-meta-card">
              <div className="page-meta-label">Primary action</div>
              <div className="page-meta-value">Create album</div>
              <div className="page-meta-sub">Add items from the timeline or photo viewer later</div>
            </div>
          </>
        }
      />

      {syncing && albums.length > 0 && (
        <div className="status-banner success" style={{ marginBottom: "0.85rem", color: "var(--ink-2)" }}>
          Pulling the latest albums.
        </div>
      )}

      <div className="panel split-input-row" style={{ marginBottom: "1rem", alignItems: "center" }}>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Album name (optional)"
          onKeyDown={(event) => {
            if (event.key === "Enter") void createAlbum();
          }}
        />
        <button className="btn btn-primary" onClick={createAlbum} disabled={creating} title={creating ? "Creating album..." : undefined}>
          {creating ? <Loader size={16} className="spin" /> : <Plus size={16} />}
          Create Album
        </button>
      </div>

      {error && (
        <div className="panel" style={{ marginBottom: "1rem", borderColor: "var(--error)", color: "var(--error)" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" style={{ width: "fit-content" }} onClick={() => void syncAlbums()}>
              Sync again
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state" style={{ minHeight: 220 }}>
          <Loader size={28} className="spin" color="var(--accent)" />
        </div>
      ) : albums.length === 0 ? (
        <div className="panel" style={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div style={{ display: "grid", gap: "0.5rem", justifyItems: "center" }}>
            <FolderOpen size={30} color="var(--muted)" />
            <p style={{ fontWeight: 700 }}>No albums yet</p>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Create one and start grouping your media.</p>
          </div>
        </div>
      ) : (
        <div className="albums-grid">
          {albums.map((album) => (
            <button
              key={album.id}
              type="button"
              className="album-card"
              onClick={() => router.push(`/albums/${album.id}`)}
              style={{ padding: 0, border: "none", textAlign: "left" }}
            >
              {album.coverUrl ? (
                <img src={album.coverUrl} alt={album.name} className="album-cover" />
              ) : (
                <div className="album-cover-placeholder">
                  <FolderOpen size={28} color="var(--muted)" />
                </div>
              )}
              <div className="album-info">
                <p className="album-name">{album.name}</p>
                <p className="album-count">{album.count} items</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
