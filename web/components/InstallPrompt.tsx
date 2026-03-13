"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/browser-storage";

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (window.matchMedia("(display-mode: standalone)").matches) return;

        const dismissedAt = safeLocalStorageGet("vpics-install-dismissed");
        if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return;

        const ua = navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        setIsIOS(isiOS);

        if (isiOS) {
            const timer = window.setTimeout(() => setShowBanner(true), 3000);
            return () => window.clearTimeout(timer);
        }

        const handler = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event);
            setShowBanner(true);
        };

        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => { });
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
        safeLocalStorageSet("vpics-install-dismissed", String(Date.now()));
    };

    if (!showBanner || dismissed) return null;

    return (
        <div className="install-banner glass-heavy">
            <div className="install-banner-content">
                <div className="install-banner-icon">
                    <Download size={20} strokeWidth={2} />
                </div>
                <div className="install-banner-text">
                    <p className="install-banner-title">Add V-Pics to Home Screen</p>
                    <p className="install-banner-sub">
                        {isIOS
                            ? <>Tap <Share size={12} strokeWidth={2.5} style={{ display: "inline", verticalAlign: "-2px" }} /> then &ldquo;Add to Home Screen&rdquo;</>
                            : "Install for quick access. Offline support is limited to safe cached assets."}
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
