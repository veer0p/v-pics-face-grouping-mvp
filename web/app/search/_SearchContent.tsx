"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    User, MapPin, Utensils, Sunset, PawPrint, Plane,
    Clock, Search, X,
} from "lucide-react";

const RECENT_KEY = "vpics_recent_searches";

const PEOPLE_CHIPS = [
    { icon: User, label: "Rahul" },
    { icon: User, label: "Priya" },
    { icon: User, label: "Family" },
];
const PLACE_CHIPS = [
    { icon: MapPin, label: "Goa" },
    { icon: MapPin, label: "Mumbai" },
    { icon: MapPin, label: "Ahmedabad" },
];
const THINGS_CHIPS = [
    { icon: Utensils, label: "Food" },
    { icon: Sunset, label: "Sunsets" },
    { icon: PawPrint, label: "Pets" },
    { icon: Plane, label: "Travel" },
];
const YEAR_CHIPS = ["2025", "2024", "2023", "2022"];

export default function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [query, setQuery] = useState(searchParams.get("q") ?? "");
    const [recents, setRecents] = useState<string[]>([]);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
            setRecents(saved);
        } catch { /* ignore */ }
        // NO auto-focus — user explicitly requested no keyboard pop-up
    }, []);

    const doSearch = (q: string) => {
        if (!q.trim()) return;
        const next = [q, ...recents.filter((r) => r !== q)].slice(0, 6);
        setRecents(next);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        setQuery(q);
        router.push(`/search?q=${encodeURIComponent(q)}`);
    };

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSearch(query); };
    const activeQuery = searchParams.get("q") ?? "";

    return (
        <div className="page-shell">
            {/* Search Input */}
            <form onSubmit={handleSubmit} style={{ marginBottom: "1.5rem" }}>
                <div className="search-page-bar">
                    <Search size={18} strokeWidth={2} className="search-page-bar-icon" />
                    <input
                        type="text"
                        placeholder="Search photos, people, places…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search"
                    />
                    {query && (
                        <button
                            type="button"
                            className="app-search-clear"
                            onClick={() => { setQuery(""); router.push("/search"); }}
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </form>

            {activeQuery ? (
                <div>
                    <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: "1rem" }}>
                        Results for <strong style={{ color: "var(--ink)" }}>&ldquo;{activeQuery}&rdquo;</strong>
                    </p>
                    <div className="empty-state" style={{ minHeight: 200 }}>
                        <Search size={32} strokeWidth={1.5} color="var(--muted)" />
                        <p className="empty-state-title">No results yet</p>
                        <p className="empty-state-sub">
                            AI search is coming soon. Upload and group some photos first!
                        </p>
                        <button className="btn btn-primary btn-sm" onClick={() => router.push("/upload")}>
                            Upload Photos
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* People */}
                    <div className="search-section">
                        <p className="section-heading" style={{ marginBottom: "0.65rem" }}>People</p>
                        <div className="search-chips-row">
                            {PEOPLE_CHIPS.map((c) => (
                                <button key={c.label} className="chip press-scale" onClick={() => doSearch(c.label)}>
                                    <c.icon size={14} strokeWidth={2} /> {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Places */}
                    <div className="search-section">
                        <p className="section-heading" style={{ marginBottom: "0.65rem" }}>Places</p>
                        <div className="search-chips-row">
                            {PLACE_CHIPS.map((c) => (
                                <button key={c.label} className="chip press-scale" onClick={() => doSearch(c.label)}>
                                    <c.icon size={14} strokeWidth={2} /> {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Things */}
                    <div className="search-section">
                        <p className="section-heading" style={{ marginBottom: "0.65rem" }}>Things</p>
                        <div className="search-chips-row">
                            {THINGS_CHIPS.map((c) => (
                                <button key={c.label} className="chip press-scale" onClick={() => doSearch(c.label)}>
                                    <c.icon size={14} strokeWidth={2} /> {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Years */}
                    <div className="search-section">
                        <p className="section-heading" style={{ marginBottom: "0.65rem" }}>Years</p>
                        <div className="search-chips-row">
                            {YEAR_CHIPS.map((y) => (
                                <button key={y} className="chip press-scale" onClick={() => doSearch(y)}>{y}</button>
                            ))}
                        </div>
                    </div>

                    {/* Recent Searches */}
                    {recents.length > 0 && (
                        <div className="search-section">
                            <div style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between", marginBottom: "0.5rem"
                            }}>
                                <p className="section-heading">Recent</p>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => { setRecents([]); localStorage.removeItem(RECENT_KEY); }}
                                >
                                    Clear
                                </button>
                            </div>
                            {recents.map((r) => (
                                <div key={r} className="recent-search-item press-scale" onClick={() => doSearch(r)}>
                                    <Clock size={14} strokeWidth={2} color="var(--muted)" />
                                    <span>{r}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
