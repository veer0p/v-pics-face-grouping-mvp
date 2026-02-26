"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [dragY, setDragY] = useState(0);
    const startY = useRef(0);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", handler);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    const onTouchStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        setDragging(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!dragging) return;
        const dy = Math.max(0, e.touches[0].clientY - startY.current);
        setDragY(dy);
    };

    const onTouchEnd = () => {
        setDragging(false);
        if (dragY > 120) { onClose(); }
        setDragY(0);
    };

    if (!open) return null;

    return (
        <div className="bottom-sheet-overlay">
            {/* Scrim */}
            <div className="bottom-sheet-scrim" onClick={onClose} />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className="bottom-sheet-panel glass-heavy"
                style={{
                    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
                    transition: dragging ? "none" : "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Drag handle */}
                <div className="bottom-sheet-handle" />

                {/* Header */}
                {title && (
                    <div className="bottom-sheet-header">
                        <h3 className="bottom-sheet-title">{title}</h3>
                        <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close">
                            <X size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="bottom-sheet-content">
                    {children}
                </div>
            </div>
        </div>
    );
}
