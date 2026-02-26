"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Settings } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
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

    return (
        <div className="app-shell">
            {!hideHeader && (
                <header
                    className={`app-header${hidden ? " header-hidden" : ""}${scrolled ? " header-scrolled" : ""}`}
                >
                    <div className="app-header-inner">
                        {/* Logo */}
                        <div className="app-logo">
                            <div className="app-logo-mark" aria-hidden="true" />
                            <span className="app-logo-text">V‑Pics</span>
                        </div>

                        {/* Spacer */}
                        <div style={{ flex: 1 }} />

                        {/* Search icon → navigates to /search */}
                        <button
                            className="app-header-btn"
                            onClick={() => router.push("/search")}
                            aria-label="Search"
                        >
                            <Search size={20} strokeWidth={2} />
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

            <main className={`page-content${hideHeader ? " no-header" : ""}`}>
                {children}
            </main>

            {!hideHeader && <InstallPrompt />}
            {!hideHeader && <BottomNav />}
        </div>
    );
}
