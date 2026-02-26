"use client";

import { Suspense } from "react";
import SearchContent from "./_SearchContent";

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="page-shell">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "1rem" }}>
                    <div className="skeleton" style={{ height: 52, borderRadius: "var(--r-md)" }} />
                    <div className="skeleton" style={{ height: 200, borderRadius: "var(--r-md)" }} />
                </div>
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}
