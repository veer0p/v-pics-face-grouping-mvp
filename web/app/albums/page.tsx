"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader, Plus } from "lucide-react";

type AlbumItem = {
  id: string;
  name: string;
  count: number;
  coverUrl: string | null;
  createdAt: string;
};

export default function AlbumsPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/albums");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load albums"));
      setAlbums(Array.isArray(data?.albums) ? data.albums : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load albums");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

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
      await loadAlbums();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create album");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-shell">
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.75rem", fontWeight: 700 }}>
          Albums
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Immich-backed albums
        </p>
      </div>

      <div className="panel" style={{ marginBottom: "1rem", display: "flex", gap: "0.6rem", alignItems: "center" }}>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Album name (optional)"
          onKeyDown={(event) => {
            if (event.key === "Enter") void createAlbum();
          }}
        />
        <button className="btn btn-primary" onClick={createAlbum} disabled={creating}>
          {creating ? <Loader size={16} className="spin" /> : <Plus size={16} />}
          Create
        </button>
      </div>

      {error && (
        <div className="panel" style={{ marginBottom: "1rem", borderColor: "var(--error)", color: "var(--error)" }}>
          {error}
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
