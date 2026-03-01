"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function FloatingUploadButton() {
    const router = useRouter();

    return (
        <button
            className="desktop-fab"
            onClick={() => router.push("/upload")}
            aria-label="Upload Photos"
            title="Upload Photos"
        >
            <Plus size={28} strokeWidth={2.5} />
        </button>
    );
}
