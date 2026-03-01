"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Settings } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { FloatingUploadButton } from "@/components/FloatingUploadButton";
import { Sidebar } from "@/components/Sidebar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MatrixBackground } from "@/components/MatrixBackground";
import { PookieBackground } from "@/components/PookieBackground";
import { useTheme } from "./ThemeProvider";
import { ACCENT_PALETTES } from "@/lib/palettes";

export function AppShell({ children }: { children: React.ReactNode }) {
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

    const hideHeader = pathname.startsWith("/photo/") || pathname.startsWith("/edit/") || pathname === "/welcome";
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

                        {/* Avatar */}
                        <button className="app-avatar" title="Account" aria-label="Account">
                            <div className="app-avatar-inner" />
                        </button>
                    </div>
                </header>
            )}

            <main className={`page-content${hideHeader ? " no-header" : ""}${showSidebar ? " with-sidebar" : ""}`}>
                {children}
            </main>

            {!hideHeader && <InstallPrompt />}
            {!hideHeader && <BottomNav />}
            {!hideHeader && <FloatingUploadButton />}
        </div>
    );
}
