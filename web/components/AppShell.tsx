"use client";
/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Heart, Loader, LogOut, RefreshCw, Settings } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { FloatingUploadButton } from "@/components/FloatingUploadButton";
import { Sidebar } from "@/components/Sidebar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PookieBackground } from "@/components/PookieBackground";
import { useTheme } from "@/components/ThemeProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { HeaderSyncProvider, type HeaderSyncAction } from "@/components/HeaderSyncContext";
import { useNetwork } from "@/components/NetworkContext";
import { trackInternalRoute } from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { user, signOut } = useAuth();
    const { isOnline } = useNetwork();
    const { resolved, accentIndex } = useTheme();
    const pathname = usePathname();
    const router = useRouter();
    const [headerSyncAction, setHeaderSyncAction] = useState<HeaderSyncAction | null>(null);

    const isFavorites = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("filter") === "favorites";
    const toggleFavorites = () => {
        const params = new URLSearchParams(window.location.search);
        if (isFavorites) params.delete("filter");
        else params.set("filter", "favorites");
        router.push(`${pathname}?${params.toString()}`);
    };

    const [scrolled, setScrolled] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const lastScrollY = useRef(0);
    const accountMenuRef = useRef<HTMLDivElement | null>(null);

    const pageTitle = (() => {
        if (pathname === "/") return "Photos";
        if (pathname.startsWith("/search")) return "Search";
        if (pathname.startsWith("/people")) return "People";
        if (pathname.startsWith("/albums")) return "Albums";
        if (pathname.startsWith("/settings")) return "Settings";
        if (pathname.startsWith("/upload")) return "Upload";
        if (pathname.startsWith("/trash")) return "Trash";
        if (pathname.startsWith("/memories")) return "Memories";
        return "V-Pics";
    })();

    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY;
            setScrolled(y > 10);
            setHidden(y > lastScrollY.current && y > 80);
            lastScrollY.current = y;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const query = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
        trackInternalRoute(query ? `${pathname}?${query}` : pathname);
    }, [isFavorites, pathname]);

    useEffect(() => {
        if (!showMenu) return;

        const closeIfOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (accountMenuRef.current?.contains(target)) return;
            setShowMenu(false);
        };

        document.addEventListener("mousedown", closeIfOutside);
        document.addEventListener("touchstart", closeIfOutside);
        return () => {
            document.removeEventListener("mousedown", closeIfOutside);
            document.removeEventListener("touchstart", closeIfOutside);
        };
    }, [showMenu]);

    const hideHeader = pathname.startsWith("/photo/") || pathname.startsWith("/edit/") || pathname === "/welcome" || pathname === "/login";
    const showSidebar = !hideHeader;
    const showFavoritesToggle = pathname === "/";

    return (
        <HeaderSyncProvider value={setHeaderSyncAction}>
            <div
                className={`app-shell${hideHeader ? " no-header" : ""}`}
                data-theme={resolved === "dark" ? "neon-barbie" : "light"}
            >
                {!hideHeader && resolved === "light" && <PookieBackground accentIndex={accentIndex} />}
                {showSidebar && <Sidebar />}

                {!hideHeader && (
                    <header className={`app-header${hidden ? " header-hidden" : ""}${scrolled ? " header-scrolled" : ""}`}>
                        <div className="app-header-inner">
                            <div className="app-header-brand">
                                {headerSyncAction?.onBack && (
                                    <button
                                        className="btn btn-icon btn-secondary"
                                        style={{ marginRight: '0.75rem', width: 34, height: 34 }}
                                        onClick={headerSyncAction.onBack}
                                        aria-label="Back"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                )}
                                <div className="app-header-brand-mark" aria-hidden="true" />
                                <div className="app-header-brand-copy">
                                    <div className="app-header-brand-kicker">V-Pics</div>
                                    {isOnline ? (
                                        <div className="app-header-brand-title">{headerSyncAction?.title || pageTitle}</div>
                                    ) : (
                                        <div className="header-offline-tag">
                                            <div className="offline-dot" />
                                            Offline
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {isOnline && headerSyncAction?.pageActions}

                                {isOnline && showFavoritesToggle && (
                                    <button
                                        className={`app-header-btn${isFavorites ? " active" : ""}`}
                                        onClick={toggleFavorites}
                                        aria-label="Filter Favorites"
                                        style={isFavorites ? { color: "var(--accent)" } : {}}
                                    >
                                        <Heart size={20} fill={isFavorites ? "var(--accent)" : "none"} strokeWidth={2} />
                                    </button>
                                )}

                                {isOnline && headerSyncAction?.onClick && (
                                    <button
                                        className="app-header-btn app-header-sync"
                                        onClick={() => void headerSyncAction.onClick!()}
                                        disabled={headerSyncAction.loading}
                                        aria-label={headerSyncAction.ariaLabel || headerSyncAction.label || "Sync"}
                                        title={headerSyncAction.label || "Sync"}
                                    >
                                        {headerSyncAction.loading ? <Loader size={18} className="spin" /> : <RefreshCw size={18} />}
                                        <span className="app-header-sync-label">
                                            {headerSyncAction.loading ? "Syncing..." : headerSyncAction.label || "Sync"}
                                        </span>
                                    </button>
                                )}

                                <div style={{ position: "relative" }} ref={accountMenuRef}>
                                    <button
                                        className="app-avatar"
                                        title="Account"
                                        aria-label="Account"
                                        onClick={() => setShowMenu((open) => !open)}
                                    >
                                        <UserAvatar
                                            src={user?.avatar_url}
                                            name={user?.full_name || user?.username || "User"}
                                            size={34}
                                            style={{ width: "100%", height: "100%" }}
                                        />
                                        {user && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    bottom: -2,
                                                    right: -2,
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: "50%",
                                                    background: "var(--accent)",
                                                    border: "2px solid var(--bg)",
                                                }}
                                            />
                                        )}
                                    </button>

                                    {showMenu && (
                                        <div
                                            className="dropdown-menu"
                                            style={{
                                                position: "absolute",
                                                top: "100%",
                                                right: 0,
                                                marginTop: "0.5rem",
                                                zIndex: 100,
                                                animation: "fadeIn 0.2s ease",
                                            }}
                                        >
                                            <div style={{ padding: "0.85rem 0.95rem" }}>
                                                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Signed in as</div>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)", wordBreak: "break-word" }}>{user?.full_name}</div>
                                                {user?.username && (
                                                    <div style={{ marginTop: "0.2rem", fontSize: "0.8rem", color: "var(--muted)" }}>@{user.username}</div>
                                                )}
                                            </div>

                                            <div className="menu-item-sep" />

                                            <button
                                                className="menu-item"
                                                onClick={() => {
                                                    setShowMenu(false);
                                                    router.push("/settings");
                                                }}
                                            >
                                                <Settings size={16} />
                                                <span>Settings</span>
                                            </button>

                                            <button
                                                className="menu-item"
                                                style={{ color: "var(--error)" }}
                                                onClick={async () => {
                                                    setShowMenu(false);
                                                    await signOut();
                                                    router.replace("/login");
                                                }}
                                            >
                                                <LogOut size={16} />
                                                <span>Sign Out</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>
                )}

                <main className={`page-content${hideHeader ? " no-header" : ""}${showSidebar ? " with-sidebar" : ""}`}>
                    <Suspense fallback={null}>{children}</Suspense>
                </main>

                {!hideHeader && <InstallPrompt />}
                {!hideHeader && <BottomNav />}
                {!hideHeader && <FloatingUploadButton />}
            </div>
        </HeaderSyncProvider>
    );
}
