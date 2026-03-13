"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Cloud, ChevronRight } from "lucide-react";

const SCREENS = [
    {
        title: "Your photos.\nBeautiful and private.",
        sub: "",
        key: "auth",
    },
    {
        title: "Let us access your photos",
        sub: "We need permission to show your existing photos from this device.",
        key: "permission",
    },
    {
        title: "Back up automatically",
        sub: "Never lose a photo again.\nBacks up in background, WiFi only.",
        key: "backup",
    },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const screen = SCREENS[step];

    const next = () => {
        if (step < SCREENS.length - 1) setStep(step + 1);
        else router.push("/");
    };
    const skip = () => router.push("/");

    return (
        <div style={{
            minHeight: "100vh", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "2rem 1.5rem", textAlign: "center",
            background: "var(--bg)",
        }}>
            {/* Logo */}
            <div className="glass" style={{
                width: 88, height: 88, borderRadius: "24px",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "3rem",
                boxShadow: "var(--shadow-lg)"
            }}>
                {screen.key === "auth" && <Camera size={32} color="#fff" strokeWidth={1.8} />}
                {screen.key === "permission" && <Camera size={32} color="#fff" strokeWidth={1.8} />}
                {screen.key === "backup" && <Cloud size={32} color="#fff" strokeWidth={1.8} />}
            </div>

            {/* Title */}
            <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: "2.4rem", fontWeight: 800, lineHeight: 1.1,
                whiteSpace: "pre-line", marginBottom: "1rem",
                letterSpacing: "-0.04em",
                color: "var(--ink)"
            }}>
                {screen.title}
            </h1>

            {screen.sub && (
                <p style={{
                    color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.55,
                    maxWidth: 300, whiteSpace: "pre-line", marginBottom: "1.5rem"
                }}>
                    {screen.sub}
                </p>
            )}

            {/* Step indicators */}
            <div style={{ display: "flex", gap: 6, margin: "1.5rem 0" }}>
                {SCREENS.map((_, i) => (
                    <div key={i} style={{
                        width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                        background: i === step ? "var(--accent)" : "var(--line-strong)",
                        transition: "width 300ms ease, background 300ms ease",
                    }} />
                ))}
            </div>

            {/* Actions per screen */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%", maxWidth: 320 }}>
                {screen.key === "auth" && (
                    <>
                        <button className="btn btn-primary" style={{ width: "100%" }} onClick={next}>
                            Continue with Google
                        </button>
                        <button className="btn btn-secondary" style={{ width: "100%" }} onClick={next}>
                            Continue with Apple
                        </button>
                        <button className="btn btn-ghost" style={{ width: "100%" }} onClick={skip}>
                            Use without account
                        </button>
                    </>
                )}
                {screen.key === "permission" && (
                    <>
                        <button className="btn btn-primary" style={{ width: "100%" }} onClick={next}>
                            Allow Access
                        </button>
                        <button className="btn btn-ghost" style={{ width: "100%" }} onClick={next}>
                            Skip for now
                        </button>
                    </>
                )}
                {screen.key === "backup" && (
                    <>
                        <button className="btn btn-primary" style={{ width: "100%" }} onClick={next}>
                            <Cloud size={16} strokeWidth={2.5} />
                            Turn on backup
                        </button>
                        <button className="btn btn-ghost" style={{ width: "100%" }} onClick={skip}>
                            Not now
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
