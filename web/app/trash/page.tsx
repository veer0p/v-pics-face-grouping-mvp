"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader, RotateCcw, Trash2 } from "lucide-react";
import type { Photo } from "@/lib/photo-cache";

export default function TrashPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadTrash = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/photos/trash?limit=200&offset=0");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to load trash"));
      setPhotos(Array.isArray(data?.photos) ? data.photos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  const contextIds = useMemo(() => photos.map((photo) => photo.id), [photos]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restoreSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/photos/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to restore assets"));
      setPhotos((prev) => prev.filter((photo) => !selected.has(photo.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore assets");
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedPermanently = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || busy) return;
    if (!window.confirm(`Permanently delete ${ids.length} asset(s)? This cannot be undone.`)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/photos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, permanent: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to permanently delete assets"));
      setPhotos((prev) => prev.filter((photo) => !selected.has(photo.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to permanently delete assets");
    } finally {
      setBusy(false);
    }
  };

  const restoreAll = async () => {
    if (busy || photos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/photos/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Failed to restore trash"));
      setPhotos([]);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore trash");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-shell">
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1rem" }}>
        <button className="btn btn-icon btn-secondary" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft size={17} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.5rem", fontWeight: 700 }}>
            Trash
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.86rem", marginTop: "0.2rem" }}>
            Soft-deleted assets from Immich
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.55rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" onClick={restoreAll} disabled={busy || photos.length === 0}>
          <RotateCcw size={14} />
          Restore All
        </button>
        <button className="btn btn-secondary btn-sm" onClick={restoreSelected} disabled={busy || selected.size === 0}>
          <RotateCcw size={14} />
          Restore Selected ({selected.size})
        </button>
        <button className="btn btn-danger btn-sm" onClick={deleteSelectedPermanently} disabled={busy || selected.size === 0}>
          <Trash2 size={14} />
          Delete Permanently
        </button>
      </div>

      {error && (
        <div className="panel" style={{ marginBottom: "1rem", borderColor: "var(--error)", color: "var(--error)" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" style={{ width: "fit-content" }} onClick={() => void loadTrash()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state" style={{ minHeight: 220 }}>
          <Loader size={28} className="spin" color="var(--accent)" />
        </div>
      ) : photos.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 220 }}>
          <p className="empty-state-title">Trash is empty</p>
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
