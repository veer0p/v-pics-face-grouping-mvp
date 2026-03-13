"use client";
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Heart, Loader, Maximize2, MoreHorizontal, Pause, Play, Send, Trash2, Users, Volume2, VolumeX, X } from "lucide-react";
import { ImageBlobCache, PhotoDetailCache, VideoBlobCache } from "@/lib/photo-cache";
import { useAuth } from "@/components/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { safeSessionStorageGet } from "@/lib/browser-storage";
import { navigateBackOr } from "@/lib/navigation";

type PhotoDetail = {
    id: string;
    url: string;
    thumbUrl: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    isLiked: boolean;
    takenAt: string | null;
    createdAt: string;
    cameraModel?: string | null;
    lensModel?: string | null;
    shutterSpeed?: string | null;
    aperture?: number | null;
    iso?: number | null;
    mediaType?: "image" | "video";
    durationMs?: number | null;
};

type CommentItem = {
    id: string;
    userId: string;
    body: string;
    createdAt: string;
    user?: { username?: string; full_name?: string; avatar_url?: string | null } | null;
};

let photoViewerSnapshot: { photos: Record<string, PhotoDetail>; comments: Record<string, CommentItem[]> } = {
    photos: {},
    comments: {},
};

const mt = (p: PhotoDetail) => (p.mediaType === "video" || p.mimeType?.startsWith("video/") ? "video" : "image");
const fb = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const fd = (i: string) => new Date(i).toLocaleString("en-IN");
const fm = (ms?: number | null) => !ms ? "0:00" : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function PhotoViewerPage({ params }: { params: Promise<{ id: string }> }) {
    const initialId = use(params).id;
    const router = useRouter();
    const { user } = useAuth();
    const moreMenuRef = useRef<HTMLDivElement | null>(null);
    const [idList, setIdList] = useState<string[]>([]);
    const [idx, setIdx] = useState(0);
    const [photos, setPhotos] = useState<Record<string, PhotoDetail>>(() => {
        if (photoViewerSnapshot.photos[initialId]) {
            return { [initialId]: photoViewerSnapshot.photos[initialId] };
        }
        return {};
    });
    const [panel, setPanel] = useState<"info" | "comments">("info");
    const [panelOpen, setPanelOpen] = useState(false);
    const [comments, setComments] = useState<Record<string, CommentItem[]>>(() => photoViewerSnapshot.comments);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [draft, setDraft] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState("");
    const [loading, setLoading] = useState(true);
    const [isZoomed, setIsZoomed] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const isLocal = initialId.startsWith("local:");
    const currentId = idList[idx];
    const photo = currentId ? photos[currentId] : null;

    useEffect(() => {
        if (isLocal) {
            const s = safeSessionStorageGet("local_photo_preview");
            if (s) {
                const p = JSON.parse(s);
                setPhotos({
                    [initialId]: {
                        id: initialId,
                        url: p.url,
                        thumbUrl: p.thumbUrl || p.url,
                        filename: p.filename || "Uploading...",
                        mimeType: p.mimeType || "image/jpeg",
                        sizeBytes: p.sizeBytes || 0,
                        width: null,
                        height: null,
                        isLiked: false,
                        takenAt: null,
                        createdAt: p.createdAt || new Date().toISOString(),
                        mediaType: p.mediaType || (String(p.mimeType || "").startsWith("video/") ? "video" : "image"),
                        durationMs: p.durationMs ?? null,
                    },
                });
            }
            setIdList([initialId]);
            setIdx(0);
            setLoading(false);
            return;
        }
        const ctx = safeSessionStorageGet("current_gallery_context");
        if (ctx) {
            try {
                const ids = JSON.parse(ctx) as string[];
                setIdList(ids);
                setIdx(Math.max(0, ids.indexOf(initialId)));
                return;
            } catch { }
        }
        setIdList([initialId]);
        setIdx(0);
    }, [initialId, isLocal]);

    useEffect(() => {
        photoViewerSnapshot = { photos, comments };
    }, [comments, photos]);

    useEffect(() => {
        // Default closed on mobile; open by default on desktop.
        if (window.matchMedia("(min-width: 1024px)").matches) {
            setPanelOpen(true);
        }
    }, []);

    useEffect(() => {
        if (!moreOpen) return;
        const handlePointer = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (moreMenuRef.current?.contains(target)) return;
            setMoreOpen(false);
        };
        window.addEventListener("mousedown", handlePointer);
        window.addEventListener("touchstart", handlePointer);
        return () => {
            window.removeEventListener("mousedown", handlePointer);
            window.removeEventListener("touchstart", handlePointer);
        };
    }, [moreOpen]);

    const preload = useCallback(async (id: string) => {
        if (!id || id.startsWith("local:") || photos[id]) return;
        const data = await PhotoDetailCache.fetchAndCache(id).catch(() => null);
        if (data) {
            setPhotos((prev) => ({ ...prev, [id]: data }));
            if (mt(data) === "image") ImageBlobCache.fetchAndCache(id, data.url, "full").catch(() => { });
            else VideoBlobCache.fetchAndCache(id, data.url).catch(() => { });
        }
    }, [photos]);

    useEffect(() => {
        if (!idList.length) return;
        const c = idList[idx];
        const prev = idx > 0 ? idList[idx - 1] : null;
        const next = idx < idList.length - 1 ? idList[idx + 1] : null;
        setLoading(!photos[c]);
        setMoreOpen(false);
        void preload(c);
        if (prev) void preload(prev);
        if (next) void preload(next);
        window.history.replaceState(null, "", `/photo/${c}`);
    }, [idList, idx, photos, preload]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") setIdx((v) => Math.max(0, v - 1));
            if (e.key === "ArrowRight") setIdx((v) => Math.min(idList.length - 1, v + 1));
            if (e.key === "Escape") navigateBackOr(router, "/");
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [idList.length, router]);

    const loadComments = useCallback(async (pid: string) => {
        if (!pid || pid.startsWith("local:")) return;
        if (!photoViewerSnapshot.comments[pid]) {
            setCommentsLoading(true);
        }
        const res = await fetch(`/api/photos/${pid}/comments`, { cache: "no-store" }).catch(() => null);
        if (res?.ok) {
            const data = await res.json();
            setComments((p) => {
                const next = { ...p, [pid]: data.comments || [] };
                photoViewerSnapshot.comments = next;
                return next;
            });
        }
        setCommentsLoading(false);
    }, []);

    useEffect(() => {
        if (!currentId || panel !== "comments" || isLocal) return;
        if (comments[currentId]) return;
        void loadComments(currentId);
    }, [comments, currentId, isLocal, loadComments, panel]);

    const like = async () => {
        if (!photo || currentId.startsWith("local:")) return;
        const liked = !photo.isLiked;
        setPhotos((p) => ({ ...p, [photo.id]: { ...photo, isLiked: liked } }));
        await fetch("/api/photos/favorite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: photo.id, liked }) }).catch(() => { });
    };

    const del = async () => {
        if (!photo || currentId.startsWith("local:")) return;
        const id = photo.id;
        const next = idList.filter((x) => x !== id);
        setIdList(next);
        if (!next.length) navigateBackOr(router, "/");
        else setIdx((v) => Math.min(v, next.length - 1));
        await fetch("/api/photos/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) }).catch(() => { });
    };

    const download = async () => {
        if (!photo) return;
        if (!photo.id.startsWith("local:")) {
            const direct = `/api/media/${photo.id}/original?download=1&filename=${encodeURIComponent(photo.filename || "asset")}`;
            window.open(direct, "_blank");
            return;
        }
        const r = await fetch(photo.url).catch(() => null);
        if (!r) return window.open(photo.url, "_blank");
        const b = await r.blob();
        const u = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = u;
        a.download = photo.filename;
        a.click();
        URL.revokeObjectURL(u);
    };

    const addComment = async () => {
        if (!currentId || !draft.trim() || currentId.startsWith("local:")) return;
        const body = draft.trim();
        setDraft("");
        const temp = `tmp-${Date.now()}`;
        setComments((p) => ({ ...p, [currentId]: [...(p[currentId] || []), { id: temp, userId: user?.id || "", body, createdAt: new Date().toISOString(), user }] }));
        const res = await fetch(`/api/photos/${currentId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }).catch(() => null);
        if (!res?.ok) return setComments((p) => ({ ...p, [currentId]: (p[currentId] || []).filter((c) => c.id !== temp) }));
        const data = await res.json();
        setComments((p) => ({ ...p, [currentId]: (p[currentId] || []).map((c) => c.id === temp ? data.comment : c) }));
    };

    const saveComment = async (commentId: string) => {
        if (!currentId || !editingDraft.trim()) return;
        const body = editingDraft.trim();
        const prev = comments[currentId] || [];
        setComments((p) => ({ ...p, [currentId]: (p[currentId] || []).map((c) => c.id === commentId ? { ...c, body } : c) }));
        setEditingId(null);
        setEditingDraft("");
        const res = await fetch(`/api/photos/${currentId}/comments/${commentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body }),
        }).catch(() => null);
        if (!res?.ok) {
            setComments((p) => ({ ...p, [currentId]: prev }));
        }
    };

    const deleteComment = async (commentId: string) => {
        if (!currentId) return;
        const prev = comments[currentId] || [];
        setComments((p) => ({ ...p, [currentId]: (p[currentId] || []).filter((c) => c.id !== commentId) }));
        const res = await fetch(`/api/photos/${currentId}/comments/${commentId}`, { method: "DELETE" }).catch(() => null);
        if (!res?.ok) {
            setComments((p) => ({ ...p, [currentId]: prev }));
        }
    };

    const visibleComments = useMemo(() => (currentId ? comments[currentId] || [] : []), [comments, currentId]);

    return (
        <div style={{ position: "fixed", inset: 0, background: "#000", color: "#fff", display: "flex", flexDirection: "column", zIndex: 100 }}>
            <div className="glass" style={{ position: "absolute", top: '16px', left: '16px', right: '16px', display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.8rem 1.2rem", borderRadius: 'var(--r-md)', zIndex: 50, border: 'none' }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigateBackOr(router, "/")} aria-label="Back to timeline"><ArrowLeft size={16} /></button>
                    <div style={{ minWidth: 0, marginLeft: "0.35rem" }}>
                        <div style={{ fontSize: "0.92rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "min(46vw, 360px)" }}>
                            {photo?.filename || "Loading asset..."}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.68)" }}>
                            {idList.length ? `${idx + 1} of ${idList.length}` : "Single item"}
                        </div>
                    </div>
                </div>
                {!isLocal && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", position: "relative" }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setMoreOpen((open) => !open)}
                            aria-label="More actions"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                        {moreOpen && (
                            <div
                                ref={moreMenuRef}
                                style={{
                                    position: "absolute",
                                    top: "calc(100% + 0.45rem)",
                                    right: 0,
                                    minWidth: 180,
                                    display: "grid",
                                    gap: 6,
                                    padding: "0.45rem",
                                    borderRadius: 16,
                                    background: "rgba(18, 20, 26, 0.96)",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
                                    zIndex: 45,
                                }}
                            >
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ justifyContent: "flex-start" }}
                                    onClick={() => {
                                        setMoreOpen(false);
                                        void like();
                                    }}
                                >
                                    <Heart size={14} fill={photo?.isLiked ? "#ff4d6a" : "none"} color={photo?.isLiked ? "#ff4d6a" : "currentColor"} />
                                    {photo?.isLiked ? "Remove favorite" : "Add favorite"}
                                </button>
                                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }} onClick={() => { setMoreOpen(false); void download(); }}>
                                    <Download size={14} />
                                    Download
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ justifyContent: "flex-start" }}
                                    onClick={() => {
                                        if (!photo) return;
                                        setMoreOpen(false);
                                        router.push(`/photo/${photo.id}/faces`);
                                    }}
                                    disabled={!photo}
                                >
                                    <Users size={14} />
                                    Face tools
                                </button>
                                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", color: "#fca5a5" }} onClick={() => { setMoreOpen(false); void del(); }}>
                                    <Trash2 size={14} />
                                    Move to trash
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
                    <Slider ids={idList} idx={idx} photos={photos} setIdx={setIdx} zoomLocked={isZoomed} onZoomChange={setIsZoomed} />
                    {!isLocal && idx > 0 && (
                        <button
                            className="desktop-only btn btn-ghost btn-sm"
                            onClick={() => setIdx((v) => Math.max(0, v - 1))}
                            aria-label="Previous asset"
                            style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", zIndex: 20, background: "rgba(0,0,0,0.45)" }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                    )}
                    {!isLocal && idx < idList.length - 1 && (
                        <button
                            className="desktop-only btn btn-ghost btn-sm"
                            onClick={() => setIdx((v) => Math.min(idList.length - 1, v + 1))}
                            aria-label="Next asset"
                            style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", zIndex: 20, background: "rgba(0,0,0,0.45)" }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    )}
                    {loading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><Loader className="spin" /></div>}
                    {!isLocal && !panelOpen && (
                        <div
                            className="mobile-only"
                            style={{
                                position: "absolute",
                                left: "50%",
                                bottom: "max(1rem, env(safe-area-inset-bottom))",
                                transform: "translateX(-50%)",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "0.35rem",
                                borderRadius: 999,
                                background: "rgba(12, 12, 18, 0.78)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                zIndex: 26,
                            }}
                        >
                            <button
                                className="btn btn-ghost btn-sm"
                                style={{ minHeight: 34, color: panelOpen && panel === "info" ? "#fff" : "rgba(255,255,255,0.78)" }}
                                onClick={() => {
                                    setPanel("info");
                                    setPanelOpen((open) => (panel === "info" ? !open : true));
                                }}
                            >
                                Details
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                style={{ minHeight: 34, color: panelOpen && panel === "comments" ? "#fff" : "rgba(255,255,255,0.78)" }}
                                onClick={() => {
                                    setPanel("comments");
                                    setPanelOpen((open) => (panel === "comments" ? !open : true));
                                }}
                            >
                                Comments
                            </button>
                        </div>
                    )}
                </div>

                {panelOpen && photo && (
                    <aside className="desktop-only glass" style={{ width: 340, margin: '16px', borderRadius: 'var(--r-lg)', border: 'none', display: "flex", flexDirection: "column", height: 'calc(100% - 32px)' }}>
                        <div className="glass" style={{ display: "flex", alignItems: "center", border: 'none', borderRadius: 'var(--r-md) var(--r-md) 0 0', margin: '4px' }}>
                            <button className="btn btn-ghost btn-sm" style={{ flex: 1, borderRadius: 0, color: panel === "info" ? "var(--accent)" : "var(--muted)" }} onClick={() => setPanel("info")}>Details</button>
                            <button className="btn btn-ghost btn-sm" style={{ flex: 1, borderRadius: 0, color: panel === "comments" ? "var(--accent)" : "var(--muted)" }} onClick={() => setPanel("comments")}>Comments</button>
                            <button className="btn btn-ghost btn-sm" style={{ borderRadius: 0 }} onClick={() => setPanelOpen(false)} aria-label="Close drawer">
                                <X size={16} />
                            </button>
                        </div>
                        {panel === "info" ? (
                            <InfoSection photo={photo} />
                        ) : (
                            <CommentsSection
                                comments={visibleComments}
                                loading={commentsLoading}
                                draft={draft}
                                setDraft={setDraft}
                                addComment={addComment}
                                currentUserId={user?.id || ""}
                                photoId={currentId || ""}
                                editingId={editingId}
                                editingDraft={editingDraft}
                                setEditingDraft={setEditingDraft}
                                onStartEdit={(c) => { setEditingId(c.id); setEditingDraft(c.body); }}
                                onCancelEdit={() => { setEditingId(null); setEditingDraft(""); }}
                                onSaveEdit={saveComment}
                                onDelete={deleteComment}
                            />
                        )}
                    </aside>
                )}

                {panelOpen && photo && (
                    <div className="mobile-only" style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "52vh", background: "var(--bg-elevated)", color: "var(--ink)", borderTop: "1px solid var(--line)", zIndex: 35 }}>
                        <div style={{ display: "flex", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                            <button className="btn btn-ghost btn-sm" style={{ flex: 1, borderRadius: 0, color: panel === "info" ? "var(--accent)" : "var(--muted)" }} onClick={() => setPanel("info")}>Details</button>
                            <button className="btn btn-ghost btn-sm" style={{ flex: 1, borderRadius: 0, color: panel === "comments" ? "var(--accent)" : "var(--muted)" }} onClick={() => setPanel("comments")}>Comments</button>
                            <button className="btn btn-ghost btn-sm" style={{ borderRadius: 0 }} onClick={() => setPanelOpen(false)} aria-label="Close drawer">
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ maxHeight: "44vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}>
                            {panel === "info" ? (
                                <InfoSection photo={photo} />
                            ) : (
                                <CommentsSection
                                    comments={visibleComments}
                                    loading={commentsLoading}
                                    draft={draft}
                                    setDraft={setDraft}
                                    addComment={addComment}
                                    currentUserId={user?.id || ""}
                                    photoId={currentId || ""}
                                    editingId={editingId}
                                    editingDraft={editingDraft}
                                    setEditingDraft={setEditingDraft}
                                    onStartEdit={(c) => { setEditingId(c.id); setEditingDraft(c.body); }}
                                    onCancelEdit={() => { setEditingId(null); setEditingDraft(""); }}
                                    onSaveEdit={saveComment}
                                    onDelete={deleteComment}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoSection({ photo }: { photo: PhotoDetail }) {
    const summary = [
        { label: "Type", value: mt(photo) === "video" ? "Video" : "Image" },
        { label: mt(photo) === "video" ? "Duration" : "Size", value: mt(photo) === "video" ? fm(photo.durationMs) : fb(photo.sizeBytes) },
        { label: "Resolution", value: photo.width && photo.height ? `${photo.width} x ${photo.height}` : "Unknown" },
    ];
    const cameraRows = [
        photo.cameraModel ? { label: "Camera", value: photo.cameraModel } : null,
        photo.lensModel ? { label: "Lens", value: photo.lensModel } : null,
        photo.aperture ? { label: "Aperture", value: `f/${photo.aperture}` } : null,
        photo.iso ? { label: "ISO", value: `${photo.iso}` } : null,
        photo.shutterSpeed ? { label: "Shutter", value: photo.shutterSpeed } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    return (
        <div style={{ padding: "0.95rem", display: "grid", gap: 12, fontSize: 13 }}>
            <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{photo.filename}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{photo.mimeType}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
                {summary.map((item) => (
                    <div key={item.label} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "0.6rem 0.65rem", background: "var(--bg-subtle)" }}>
                        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontWeight: 700, color: "var(--ink)", lineHeight: 1.25 }}>{item.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Timeline</div>
                <Meta label="Captured" value={photo.takenAt ? fd(photo.takenAt) : "Unknown"} />
                <Meta label="Uploaded" value={fd(photo.createdAt)} />
            </div>

            {cameraRows.length > 0 && (
                <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Camera</div>
                    {cameraRows.map((row) => <Meta key={row.label} label={row.label} value={row.value} />)}
                </div>
            )}
        </div>
    );
}

function CommentsSection({
    comments,
    loading,
    draft,
    setDraft,
    addComment,
    currentUserId,
    photoId,
    editingId,
    editingDraft,
    setEditingDraft,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onDelete,
}: {
    comments: CommentItem[];
    loading: boolean;
    draft: string;
    setDraft: (v: string) => void;
    addComment: () => void;
    currentUserId: string;
    photoId: string;
    editingId: string | null;
    editingDraft: string;
    setEditingDraft: (v: string) => void;
    onStartEdit: (c: CommentItem) => void;
    onCancelEdit: () => void;
    onSaveEdit: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    return (
        <div style={{ padding: "0.9rem", display: "grid", gap: 8, fontSize: 13 }}>
            {photoId?.startsWith("local:") ? (
                <div style={{ color: "var(--muted)" }}>Comments available after upload completes.</div>
            ) : (
                <>
                    <div style={{ display: "flex", gap: 6 }}>
                        <textarea className="input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment..." />
                        <button className="btn btn-primary btn-sm" onClick={addComment} disabled={!draft.trim()}><Send size={14} /></button>
                    </div>
                    {loading ? (
                        <div style={{ display: "grid", placeItems: "center" }}><Loader size={16} className="spin" /></div>
                    ) : comments.length === 0 ? (
                        <div style={{ color: "var(--muted)" }}>No comments yet.</div>
                    ) : (
                        comments.map((c) => (
                            <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "0.55rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6, gap: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                        <UserAvatar
                                            src={c.user?.avatar_url}
                                            name={c.user?.full_name || c.user?.username || "User"}
                                            size={24}
                                        />
                                        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {c.user?.full_name || c.user?.username || "User"}
                                        </strong>
                                    </div>
                                    <span style={{ color: "var(--muted)", flexShrink: 0 }}>{fd(c.createdAt)}</span>
                                </div>
                                {editingId === c.id ? (
                                    <div style={{ display: "grid", gap: 6 }}>
                                        <textarea className="input" rows={2} value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)} />
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => onSaveEdit(c.id)}>Save</button>
                                            <button className="btn btn-secondary btn-sm" onClick={onCancelEdit}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>{c.body}</div>
                                )}
                                {c.userId === currentUserId && editingId !== c.id && (
                                    <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => onStartEdit(c)}>Edit</button>
                                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => onDelete(c.id)}>Delete</button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </>
            )}
        </div>
    );
}

function Slider({
    ids,
    idx,
    photos,
    setIdx,
    zoomLocked,
    onZoomChange,
}: {
    ids: string[];
    idx: number;
    photos: Record<string, PhotoDetail>;
    setIdx: (v: number) => void;
    zoomLocked: boolean;
    onZoomChange: (zoomed: boolean) => void;
}) {
    const [dx, setDx] = useState(0);
    const [drag, setDrag] = useState(false);
    const sx = useRef(0);
    const start = (x: number) => { sx.current = x; setDrag(true); };
    const move = (x: number) => drag && setDx(x - sx.current);
    const end = () => {
        if (!drag) return;
        const th = window.innerWidth / 5;
        if (dx > th && idx > 0) setIdx(idx - 1);
        if (dx < -th && idx < ids.length - 1) setIdx(idx + 1);
        setDx(0);
        setDrag(false);
    };
    const slide = (i: number, off: number) => {
        const id = ids[i];
        if (!id) return null;
        const p = photos[id];
        return (
            <div key={id} style={{ position: "absolute", inset: 0, transform: `translateX(calc(${off * 100}% + ${dx}px))`, transition: drag ? "none" : "transform 260ms ease", display: "grid", placeItems: "center" }}>
                {p ? <Media photo={p} current={off === 0} onZoomChange={off === 0 ? onZoomChange : () => { }} /> : <Loader className="spin" />}
            </div>
        );
    };
    return (
        <div style={{ position: "absolute", inset: 0, touchAction: "none" }}
            onTouchStart={(e) => {
                if (zoomLocked) return;
                if (e.touches.length !== 1) return;
                start(e.touches[0].clientX);
            }}
            onTouchMove={(e) => {
                if (zoomLocked) return;
                if (e.touches.length !== 1) return;
                move(e.touches[0].clientX);
                if (Math.abs(dx) > 8 && e.cancelable) e.preventDefault();
            }}
            onTouchEnd={() => {
                if (zoomLocked) return;
                end();
            }}
            onMouseDown={(e) => {
                if (zoomLocked) return;
                start(e.clientX);
                const mm = (x: MouseEvent) => move(x.clientX);
                const mu = () => { end(); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
                window.addEventListener("mousemove", mm);
                window.addEventListener("mouseup", mu);
            }}
        >
            {slide(idx - 1, -1)}
            {slide(idx, 0)}
            {slide(idx + 1, 1)}
        </div>
    );
}

function Media({ photo, current, onZoomChange }: { photo: PhotoDetail; current: boolean; onZoomChange: (zoomed: boolean) => void }) {
    const isVideo = mt(photo) === "video";
    const [src, setSrc] = useState(photo.url);
    useEffect(() => {
        if (isVideo || photo.id.startsWith("local:")) return;
        const c = new AbortController();
        ImageBlobCache.fetchAndCache(photo.id, photo.url, "full", c.signal).then(setSrc).catch(() => setSrc(photo.url));
        return () => c.abort();
    }, [isVideo, photo.id, photo.url]);
    useEffect(() => {
        if (isVideo) onZoomChange(false);
    }, [isVideo, onZoomChange]);
    if (isVideo) return <CleanVideoPlayer id={photo.id} src={photo.url} poster={photo.thumbUrl || undefined} preload={current ? "metadata" : "none"} />;
    return <ZoomableImage src={src} alt={photo.filename} onZoomChange={onZoomChange} />;
}

function CleanVideoPlayer({
    id,
    src,
    poster,
    preload,
}: {
    id: string;
    src: string;
    poster?: string;
    preload: "none" | "metadata";
}) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [resolvedSrc, setResolvedSrc] = useState(src);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        setResolvedSrc(src);
    }, [src]);

    useEffect(() => {
        if (id.startsWith("local:")) return;
        const controller = new AbortController();
        VideoBlobCache.fetchAndCache(id, src, controller.signal)
            .then((cachedUrl) => setResolvedSrc(cachedUrl))
            .catch(() => setResolvedSrc(src));
        return () => controller.abort();
    }, [id, src]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        setPlaying(!v.paused && !v.ended);
        setMuted(v.muted);
        setCurrentTime(v.currentTime || 0);
        setDuration(v.duration || 0);
    }, [resolvedSrc]);

    const sync = () => {
        const v = videoRef.current;
        if (!v) return;
        setPlaying(!v.paused && !v.ended);
        setMuted(v.muted);
        setCurrentTime(v.currentTime || 0);
        setDuration(v.duration || 0);
    };

    const togglePlay = async () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) await v.play().catch(() => { });
        else v.pause();
        sync();
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        sync();
    };

    const seek = (nextSeconds: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, Math.min(Number.isFinite(v.duration) ? v.duration : nextSeconds, nextSeconds));
        sync();
    };

    const openFullscreen = async () => {
        const el = frameRef.current;
        if (!el || !el.requestFullscreen) return;
        await el.requestFullscreen().catch(() => { });
    };

    return (
        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", padding: "0.75rem" }}>
            <div
                ref={frameRef}
                style={{
                    display: "inline-block",
                    width: "fit-content",
                    maxWidth: "100%",
                    maxHeight: "calc(100vh - 8rem)",
                    background: "#040404",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 14,
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                <video
                    ref={videoRef}
                    src={resolvedSrc}
                    poster={poster}
                    preload={preload}
                    playsInline
                    onLoadedMetadata={sync}
                    onTimeUpdate={sync}
                    onPlay={sync}
                    onPause={sync}
                    onVolumeChange={sync}
                    onClick={togglePlay}
                    style={{
                        display: "block",
                        width: "auto",
                        height: "auto",
                        maxWidth: "100%",
                        maxHeight: "calc(100vh - 8rem)",
                        objectFit: "contain",
                        background: "#000",
                    }}
                />

                {!playing && (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={togglePlay}
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            borderRadius: 999,
                            width: 60,
                            height: 60,
                            minHeight: 60,
                            padding: 0,
                        }}
                    >
                        <Play size={26} />
                    </button>
                )}

                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0.55rem 0.7rem",
                        background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.2), transparent)",
                    }}
                >
                    <button className="btn btn-ghost btn-sm" style={{ minHeight: 34, height: 34, width: 34, padding: 0 }} onClick={togglePlay}>
                        {playing ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={Math.max(duration, 0)}
                        step={0.1}
                        value={Math.min(currentTime, duration || currentTime)}
                        onChange={(e) => seek(Number(e.target.value))}
                        style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 11, minWidth: 76, textAlign: "right" }}>
                        {fm(Math.round(currentTime * 1000))} / {fm(Math.round(duration * 1000))}
                    </span>
                    <button className="btn btn-ghost btn-sm" style={{ minHeight: 34, height: 34, width: 34, padding: 0 }} onClick={toggleMute}>
                        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ minHeight: 34, height: 34, width: 34, padding: 0 }} onClick={openFullscreen}>
                        <Maximize2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function ZoomableImage({ src, alt, onZoomChange }: { src: string; alt: string; onZoomChange: (zoomed: boolean) => void }) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartScaleRef = useRef(1);
    const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
    const [scale, setScale] = useState(1);
    const [tx, setTx] = useState(0);
    const [ty, setTy] = useState(0);

    const clampScale = useCallback((value: number) => Math.min(4, Math.max(1, value)), []);

    const clampTranslate = useCallback((x: number, y: number, s = scale) => {
        const frame = frameRef.current;
        if (!frame) return { x, y };
        const maxX = Math.max(0, ((s - 1) * frame.clientWidth) / 2);
        const maxY = Math.max(0, ((s - 1) * frame.clientHeight) / 2);
        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            y: Math.max(-maxY, Math.min(maxY, y)),
        };
    }, [scale]);

    useEffect(() => {
        const zoomed = scale > 1.01;
        onZoomChange(zoomed);
        if (!zoomed) {
            setTx(0);
            setTy(0);
        }
    }, [onZoomChange, scale]);

    useEffect(() => {
        setScale(1);
        setTx(0);
        setTy(0);
        pointersRef.current.clear();
        pinchStartDistanceRef.current = null;
        panStartRef.current = null;
        onZoomChange(false);
    }, [onZoomChange, src]);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointersRef.current.size === 1 && scale > 1) {
            panStartRef.current = { x: e.clientX, y: e.clientY, tx, ty };
        }

        if (pointersRef.current.size === 2) {
            const pts = Array.from(pointersRef.current.values());
            pinchStartDistanceRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            pinchStartScaleRef.current = scale;
            panStartRef.current = null;
        }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointersRef.current.has(e.pointerId)) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointersRef.current.size >= 2) {
            const pts = Array.from(pointersRef.current.values());
            const currentDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            const baseDistance = pinchStartDistanceRef.current || currentDistance;
            const nextScale = clampScale((pinchStartScaleRef.current || 1) * (currentDistance / Math.max(baseDistance, 1)));
            setScale(nextScale);
            if (e.cancelable) e.preventDefault();
            return;
        }

        if (scale > 1 && panStartRef.current) {
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            const next = clampTranslate(panStartRef.current.tx + dx, panStartRef.current.ty + dy);
            setTx(next.x);
            setTy(next.y);
            if (e.cancelable) e.preventDefault();
        }
    };

    const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) {
            pinchStartDistanceRef.current = null;
        }
        if (pointersRef.current.size === 0) {
            panStartRef.current = null;
        }
    };

    const toggleZoom = () => {
        if (scale > 1) {
            setScale(1);
            setTx(0);
            setTy(0);
        } else {
            setScale(2);
        }
    };

    return (
        <div
            ref={frameRef}
            style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", overflow: "hidden", touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onDoubleClick={toggleZoom}
            onTouchMove={(e) => {
                if (scale > 1 && e.cancelable) e.preventDefault();
            }}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                    transformOrigin: "center center",
                    transition: pointersRef.current.size === 0 ? "transform 120ms ease-out" : "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    pointerEvents: "none",
                }}
            />
        </div>
    );
}

function Meta({ label, value }: { label: string; value: string }) {
    return <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ color: "var(--muted)" }}>{label}</span><span style={{ textAlign: "right" }}>{value}</span></div>;
}
