"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Image, Loader, RefreshCw, FolderPlus } from "lucide-react";

type Album = {
    id: string;
    name: string;
    count: number;
    coverUrl: string | null;
    createdAt: string;
};

export default function AlbumsPage() {
    const router = useRouter();
    const [albums, setAlbums] = useState<Album[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const fetchAlbums = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/albums");
            const data = await res.json();
            setAlbums(data.albums || []);
        } catch (err) {
            console.error("Fetch albums error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAlbums(); }, []);

    const handleCreateAlbum = async () => {
        const name = prompt("Enter album name:");
        if (!name?.trim()) return;

        setCreating(true);
        try {
            const res = await fetch("/api/albums", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                router.push(`/albums/${data.album.id}`);
            }
        } catch (err) {
            console.error("Create album error:", err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="page-shell">
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "1.25rem",
            }}>
                <div>
                    <h1 style={{
                        fontFamily: "var(--font-display)", fontStyle: "italic",
                        fontSize: "1.75rem", fontWeight: 700,
                    }}>
                        Albums
                    </h1>
                    <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.15rem" }}>
                        Manage your collections
                    </p>
                </div>
                <button className="app-header-btn" onClick={fetchAlbums} disabled={loading}>
                    <RefreshCw size={18} className={loading && !creating ? "spin" : ""} />
                </button>
            </div>

            {loading && albums.length === 0 && (
                <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
                    <Loader size={28} className="spin" color="var(--accent)" />
                </div>
            )}

            {!loading && albums.length === 0 && (
                <div className="empty-state" style={{ minHeight: 300 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: "var(--r-lg)",
                        background: "var(--bg-subtle)", display: "flex",
                        alignItems: "center", justifyContent: "center", marginBottom: "0.5rem",
                    }}>
                        <FolderPlus size={28} color="var(--muted)" strokeWidth={1.5} />
                    </div>
                    <p className="empty-state-title">No albums yet</p>
                    <p className="empty-state-sub">Create an album to organize your photos.</p>
                    <button className="btn btn-primary" onClick={handleCreateAlbum}
                        disabled={creating} style={{ marginTop: "1rem", gap: "0.4rem" }}>
                        {creating ? <Loader size={16} className="spin" /> : <Plus size={16} />}
                        New Album
                    </button>
                </div>
            )}

            {albums.length > 0 && (
                <div className="responsive-grid" style={{ gap: '1rem' }}>
                    {/* Create New Card */}
                    <div className="album-card" onClick={handleCreateAlbum} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: '0.75rem' }}>
                        <div className="album-cover-placeholder"
                            style={{ background: "var(--accent-soft)", color: "var(--accent)", aspectRatio: '1', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {creating ? <Loader size={32} className="spin" /> : <Plus size={32} strokeWidth={2.5} />}
                        </div>
                        <div className="album-info">
                            <p className="album-name" style={{ color: "var(--accent)", fontWeight: 700 }}>New Album</p>
                            <p className="album-count">Create a collection</p>
                        </div>
                    </div>

                    {/* Real Albums */}
                    {albums.map((album) => (
                        <div className="album-card" key={album.id}
                            style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: '0.75rem' }}
                            onClick={() => router.push(`/albums/${album.id}`)}>
                            <div className="album-cover-placeholder" style={{ background: "var(--bg-subtle)", position: "relative", aspectRatio: '1', borderRadius: 'var(--r-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {album.coverUrl ? (
                                    <img src={album.coverUrl} alt={album.name} style={{
                                        width: "100%", height: "100%", objectFit: "cover",
                                    }} />
                                ) : (
                                    <Image size={32} strokeWidth={1.5} color="var(--muted)" />
                                )}
                            </div>
                            <div className="album-info">
                                <p className="album-name" style={{ fontWeight: 700 }}>{album.name}</p>
                                <p className="album-count">{album.count} photos</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
