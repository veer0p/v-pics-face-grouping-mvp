"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Search, Users, FolderOpen, Plus } from "lucide-react";

const NAV_ITEMS = [
    { href: "/", Icon: Home, label: "Photos" },
    { href: "/search", Icon: Search, label: "Search" },
    { href: "/upload", Icon: Plus, label: "Upload", isProminent: true },
    { href: "/people", Icon: Users, label: "People" },
    { href: "/albums", Icon: FolderOpen, label: "Albums" },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="bottom-nav">
            <div className="bottom-nav-inner">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.isProminent ? pathname === item.href : (
                        item.href === "/"
                            ? pathname === "/" || pathname.startsWith("/jobs")
                            : pathname.startsWith(item.href)
                    );

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`bottom-nav-item${isActive ? " active" : ""}${item.isProminent ? " prominent" : ""}`}
                        >
                            <span className="nav-icon">
                                <item.Icon
                                    size={item.isProminent ? 28 : 22}
                                    strokeWidth={isActive || item.isProminent ? 2.5 : 1.7}
                                    fill={isActive && !item.isProminent ? "currentColor" : "none"}
                                />
                            </span>
                            {!item.isProminent && <span className="nav-label">{item.label}</span>}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
