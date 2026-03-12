"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Search, Users, FolderOpen, Settings } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";

const NAV_ITEMS = [
    { href: "/", Icon: Home, label: "Photos" },
    { href: "/search", Icon: Search, label: "Search" },
    { href: "/people", Icon: Users, label: "People" },
    { href: "/albums", Icon: FolderOpen, label: "Albums" },
    { href: "/settings", Icon: Settings, label: "Settings" },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="app-logo-mark" aria-hidden="true" />
                <span className="app-logo-text" style={{ fontSize: '1rem' }}>V‑Pics</span>
            </div>

            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.href === "/"
                            ? pathname === "/" || pathname.startsWith("/upload") || pathname.startsWith("/jobs")
                            : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-item${isActive ? " active" : ""}`}
                        >
                            <item.Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div style={{ flex: 1 }} />

            {/* Profile / Avatar at bottom */}
            <div className="sidebar-item" style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: '1.5rem', borderRadius: 0 }}>
                <UserAvatar
                    src={user?.avatar_url}
                    name={user?.full_name || user?.username || "User"}
                    size={24}
                />
                <span>Account</span>
            </div>
        </aside>
    );
}
