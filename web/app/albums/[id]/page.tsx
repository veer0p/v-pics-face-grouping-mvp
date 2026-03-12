"use client";
/* eslint-disable @next/next/no-img-element */

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader, Pencil, Save, Trash2, X } from "lucide-react";
import type { Photo } from "@/lib/photo-cache";

type Album = {
  id: string;
  name: string;
  count: number;
  coverUrl: string | null;
  createdAt: string;
};

export default function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadAlbum = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load album"));
      setAlbum(data.album || null);
      setNameDraft(String(data?.album?.name || ""));
      setPhotos(Array.isArray(data?.photos) ? data.photos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load album");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadAlbum();
  }, [loadAlbum]);

  const contextIds = useMemo(() => photos.map((photo) => photo.id), [photos]);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!album || !trimmed || trimmed === album.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to rename album"));
      setAlbum(data.album || null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename album");
    } finally {
      setSaving(false);
    }
  };

  const deleteAlbum = async () => {
    if (!album) return;
    if (!window.confirm(`Delete album "${album.name}"?`)) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to delete album"));
      router.replace("/albums");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete album");
      setSaving(false);
    }
  };

  const toggleSelect = (photoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const removeSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${id}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to remove photos"));
      setPhotos((prev) => prev.filter((photo) => !selected.has(photo.id)));
      setSelected(new Set());
      await loadAlbum();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photos");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="empty-state" style={{ minHeight: 220 }}>
          <Loader size={28} className="spin" color="var(--accent)" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
        <button className="btn btn-icon btn-secondary" onClick={() => router.push("/albums")} aria-label="Back to albums">
          <ArrowLeft size={17} />
        </button>

        <div style={{ flex: 1 }}>
          {editing ? (
            <input className="input" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
          ) : (
            <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.5rem", fontWeight: 700 }}>
              {album?.name || "Album"}
            </h1>
          )}
          <p style={{ color: "var(--muted)", fontSize: "0.86rem", marginTop: "0.25rem" }}>
            {photos.length} items
          </p>
        </div>

        {editing ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setNameDraft(album?.name || ""); }}>
              <X size={14} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={saveName} disabled={saving || !nameDraft.trim()}>
              <Save size={14} />
            </button>
          </>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={14} />
            Rename
          </button>
        )}
      </div>

      {error && (
        <div className="panel" style={{ marginBottom: "1rem", borderColor: "var(--error)", color: "var(--error)" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" style={{ width: "fit-content" }} onClick={() => void loadAlbum()}>
              Retry
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>
          Clear Selection
        </button>
        <button className="btn btn-danger btn-sm" onClick={removeSelected} disabled={saving || selected.size === 0}>
          <Trash2 size={14} />
          Remove ({selected.size})
        </button>
        <button className="btn btn-danger btn-sm" onClick={deleteAlbum} disabled={saving}>
          <Trash2 size={14} />
          Delete Album
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 220 }}>
          <p className="empty-state-title">No media in this album</p>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/")}>
            Back to Timeline
          </button>
        </div>
      ) : (
        <div className="responsive-grid">
          {photos.map((photo) => {
            const isSelected = selected.has(photo.id);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={(event) => {
                  if (event.shiftKey || selected.size > 0) {
                    toggleSelect(photo.id);
                    return;
                  }
                  sessionStorage.setItem("current_gallery_context", JSON.stringify(contextIds));
                  router.push(`/photo/${photo.id}`);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  toggleSelect(photo.id);
                }}
                style={{
                  border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                  background: "transparent",
                  padding: 0,
                  borderRadius: "var(--r-sm)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img src={photo.thumbUrl || photo.url} alt={photo.filename} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
