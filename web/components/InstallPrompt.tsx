"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia("(display-mode: standalone)").matches) return;

        // Check if dismissed recently
        const dismissedAt = localStorage.getItem("vpics-install-dismissed");
        if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return;

        // iOS detection
        const ua = navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        setIsIOS(isiOS);

        if (isiOS) {
            // Show iOS instructions after 3 seconds
            const t = setTimeout(() => setShowBanner(true), 3000);
            return () => clearTimeout(t);
        }

        // Android/Desktop: listen for beforeinstallprompt
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowBanner(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    useEffect(() => {
        // Register service worker
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(() => { });
        }
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setShowBanner(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setDismissed(true);
        setShowBanner(false);
        localStorage.setItem("vpics-install-dismissed", String(Date.now()));
    };

    if (!showBanner || dismissed) return null;

    return (
        <div className="install-banner glass-heavy">
            <div className="install-banner-content">
                <div className="install-banner-icon">
                    <Download size={20} strokeWidth={2} />
                </div>
                <div className="install-banner-text">
                    <p className="install-banner-title">Add V‑Pics to Home Screen</p>
                    <p className="install-banner-sub">
                        {isIOS
                            ? <>Tap <Share size={12} strokeWidth={2.5} style={{ display: "inline", verticalAlign: "-2px" }} /> then &ldquo;Add to Home Screen&rdquo;</>
                            : "Install for quick access — works offline!"}
                    </p>
                </div>
                <div className="install-banner-actions">
                    {!isIOS && (
                        <button className="btn btn-primary btn-sm" onClick={handleInstall}>
                            Install
                        </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={handleDismiss}>
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
