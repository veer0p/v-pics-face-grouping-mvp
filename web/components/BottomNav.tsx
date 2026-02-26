"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Search, Users, FolderOpen } from "lucide-react";

const NAV_ITEMS = [
    { href: "/", Icon: Home, label: "Photos" },
    { href: "/search", Icon: Search, label: "Search" },
    { href: "/people", Icon: Users, label: "People" },
    { href: "/albums", Icon: FolderOpen, label: "Albums" },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="bottom-nav">
            <div className="bottom-nav-inner">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.href === "/"
                            ? pathname === "/" || pathname.startsWith("/upload") || pathname.startsWith("/jobs")
                            : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`bottom-nav-item${isActive ? " active" : ""}`}
                        >
                            <span className="nav-icon">
                                <item.Icon
                                    size={22}
                                    strokeWidth={isActive ? 2.4 : 1.7}
                                    fill={isActive ? "currentColor" : "none"}
                                />
                            </span>
                            <span className="nav-label">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
