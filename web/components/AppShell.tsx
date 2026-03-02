"use client";
/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings, LogOut, Heart } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { FloatingUploadButton } from "@/components/FloatingUploadButton";
import { Sidebar } from "@/components/Sidebar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MatrixBackground } from "@/components/MatrixBackground";
import { PookieBackground } from "@/components/PookieBackground";
import { useTheme } from "./ThemeProvider";
import { ACCENT_PALETTES } from "@/lib/palettes";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { user, signOut } = useAuth();
    const { resolved, accentIndex } = useTheme();
    const activePalette = ACCENT_PALETTES[resolved][accentIndex] || ACCENT_PALETTES[resolved][0];
    const pathname = usePathname();
    const router = useRouter();

    // Favorites filter logic
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

    const hideHeader = pathname.startsWith("/photo/") || pathname.startsWith("/edit/") || pathname === "/welcome" || pathname === "/login";
    const showSidebar = !hideHeader;

    return (
        <div className="app-shell">
            {resolved === "dark" ? <MatrixBackground accentColor={activePalette.accent} /> : <PookieBackground accentIndex={accentIndex} />}

            {showSidebar && <Sidebar />}

            {!hideHeader && (
                <header
                    className={`app-header${hidden ? " header-hidden" : ""}${scrolled ? " header-scrolled" : ""}`}
                >
                    <div className="app-header-inner">

                        {/* Spacer */}
                        <div style={{ flex: 1 }} />

                        {/* Favorites toggle icon */}
                        <button
                            className={`app-header-btn${isFavorites ? " active" : ""}`}
                            onClick={toggleFavorites}
                            aria-label="Filter Favorites"
                            style={isFavorites ? { color: "var(--accent)" } : {}}
                        >
                            <Heart size={20} fill={isFavorites ? "var(--accent)" : "none"} strokeWidth={2} />
                        </button>

                        {/* Settings icon → navigates to /settings */}
                        <button
                            className="app-header-btn"
                            onClick={() => router.push("/settings")}
                            aria-label="Settings"
                        >
                            <Settings size={20} strokeWidth={2} />
                        </button>

                        {/* Avatar / Account */}
                        <div style={{ position: "relative" }}>
                            <button
                                className="app-avatar"
                                title="Account"
                                aria-label="Account"
                                onClick={() => setShowMenu(!showMenu)}
                            >
                                {user?.avatar_url ? (
                                    <img
                                        src={user.avatar_url}
                                        alt="Profile"
                                        style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                                    />
                                ) : (
                                    <div className="app-avatar-inner" />
                                )}
                                {user && (
                                    <div style={{
                                        position: "absolute",
                                        bottom: -2,
                                        right: -2,
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background: "var(--accent)",
                                        border: "2px solid var(--bg)"
                                    }} />
                                )}
                            </button>

                            {showMenu && (
                                <div className="glass" style={{
                                    position: "absolute",
                                    top: "100%",
                                    right: 0,
                                    marginTop: "0.5rem",
                                    minWidth: "180px",
                                    padding: "0.5rem",
                                    borderRadius: "1rem",
                                    zIndex: 100,
                                    animation: "fadeIn 0.2s ease"
                                }}>
                                    <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--line)", marginBottom: "0.35rem" }}>
                                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Signed in as</div>
                                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)", wordBreak: "break-all" }}>{user?.full_name}</div>
                                    </div>

                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ width: "100%", justifyContent: "flex-start", color: "var(--error)" }}
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
                </header>
            )}

            <main className={`page-content${hideHeader ? " no-header" : ""}${showSidebar ? " with-sidebar" : ""}`}>
                <Suspense fallback={null}>
                    {children}
                </Suspense>
            </main>

            {!hideHeader && <InstallPrompt />}
            {!hideHeader && <BottomNav />}
            {!hideHeader && <FloatingUploadButton />}
        </div>
    );
}
