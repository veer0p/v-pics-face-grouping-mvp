"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Clock, Loader, Search, User, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageSet,
} from "@/lib/browser-storage";
import type { Photo } from "@/lib/photo-cache";

const RECENT_KEY = "vpics_recent_searches";

type SearchPerson = {
  id: string;
  name: string;
  thumbnailUrl: string;
};

type SearchResponse = {
  photos: Photo[];
  people: SearchPerson[];
  smartSearchAvailable: boolean;
};

export default function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [recents, setRecents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse>({ photos: [], people: [], smartSearchAvailable: false });

  useEffect(() => {
    try {
      const saved = JSON.parse(safeLocalStorageGet(RECENT_KEY) ?? "[]") as string[];
      setRecents(saved);
    } catch {
      setRecents([]);
    }
  }, []);

  const doSearch = (q: string) => {
    if (!q.trim()) return;
    const trimmed = q.trim();
    const next = [trimmed, ...recents.filter((r) => r !== trimmed)].slice(0, 8);
    setRecents(next);
    safeLocalStorageSet(RECENT_KEY, JSON.stringify(next));
    setQuery(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const activeQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    if (!activeQuery) {
      setResult({ photos: [], people: [], smartSearchAvailable: false });
      setLoading(false);
      setError(null);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(activeQuery)}&limit=120&page=1`);
        const data = await res.json();
        if (!res.ok) throw new Error(String(data?.error || "Search failed"));
        setResult({
          photos: Array.isArray(data?.photos) ? data.photos : [],
          people: Array.isArray(data?.people) ? data.people : [],
          smartSearchAvailable: !!data?.smartSearchAvailable,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [activeQuery]);

  const contextIds = useMemo(() => result.photos.map((photo) => photo.id), [result.photos]);

  return (
    <div className="page-shell">
      <PageHeader
        title="Search"
      />

      <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
        <div className="search-page-bar glass" style={{ padding: "1rem 1.5rem", borderRadius: 'var(--r-xl)', border: 'none' }}>
          <Search size={22} strokeWidth={2.5} className="search-page-bar-icon" style={{ color: 'var(--accent)' }} />
          <input
            type="text"
            placeholder="Search photos, people, places..."
            style={{ fontSize: "1.1rem", fontWeight: 500 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          {query && (
            <button
              type="button"
              className="app-search-clear"
              onClick={() => {
                setQuery("");
                router.push("/search");
              }}
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </form>

      {activeQuery ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          <p className="muted-copy">
            Results for <strong style={{ color: "var(--ink)" }}>&ldquo;{activeQuery}&rdquo;</strong>
            {!result.smartSearchAvailable && " (fallback metadata mode)"}
          </p>

          {loading && (
            <div className="empty-state" style={{ minHeight: 180 }}>
              <Loader size={28} className="spin" color="var(--accent)" />
            </div>
          )}

          {error && (
            <div className="panel" style={{ color: "var(--error)", borderColor: "var(--error)" }}>
              <div style={{ display: "grid", gap: "0.55rem" }}>
                <span>{error}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: "fit-content" }}
                  onClick={() => doSearch(activeQuery)}
                >
                  Retry Search
                </button>
              </div>
            </div>
          )}

          {!loading && result.people.length > 0 && (
            <div>
              <p className="section-heading" style={{ marginBottom: "0.65rem" }}>People</p>
              <div className="search-people-row">
                {result.people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => router.push(`/people?personId=${encodeURIComponent(person.id)}`)}
                    className="entity-card"
                    style={{ minWidth: 110 }}
                  >
                    <img src={person.thumbnailUrl} alt={person.name} className="entity-card-thumb" />
                    <span className="entity-card-title">{person.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && result.photos.length > 0 && (
            <div className="responsive-grid">
              {result.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  style={{ border: "none", background: "transparent", padding: 0, borderRadius: "var(--r-sm)", overflow: "hidden" }}
                  onClick={() => {
                    safeSessionStorageSet("current_gallery_context", JSON.stringify(contextIds));
                    router.push(`/photo/${photo.id}`);
                  }}
                >
                  <img src={photo.thumbUrl || photo.url} alt={photo.filename} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                </button>
              ))}
            </div>
          )}

          {!loading && !error && result.photos.length === 0 && result.people.length === 0 && (
            <div className="empty-state" style={{ minHeight: 180 }}>
              <p className="empty-state-title">No results</p>
              <p className="empty-state-sub">Try another query or upload more media.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="search-section">
            <p className="section-heading" style={{ marginBottom: "0.5rem" }}>Recent</p>
            {recents.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>No recent searches.</p>
            ) : (
              recents.map((r) => (
                <div key={r} className="recent-search-item press-scale" onClick={() => doSearch(r)}>
                  <Clock size={14} strokeWidth={2} color="var(--muted)" />
                  <span>{r}</span>
                </div>
              ))
            )}
          </div>

          {recents.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setRecents([]);
                safeLocalStorageRemove(RECENT_KEY);
              }}
            >
              Clear recent searches
            </button>
          )}

          <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "var(--r-md)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: "0.83rem", display: "flex", gap: "0.45rem", alignItems: "center" }}>
            <User size={14} />
            Search uses Immich smart search when available, with metadata fallback.
          </div>
        </>
      )}
    </div>
  );
}
