"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

interface ToastProps {
    message: string;
    duration?: number;
    onDone?: () => void;
}

export function Toast({ message, duration = 3000, onDone }: ToastProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onDone?.(), 300);
        }, duration);
        return () => clearTimeout(t);
    }, [duration, onDone]);

    return (
        <div
            className={`toast${visible ? " toast-visible" : ""}`}
            role="status"
            aria-live="polite"
        >
            <CheckCircle size={16} strokeWidth={2.5} />
            {message}
        </div>
    );
}
