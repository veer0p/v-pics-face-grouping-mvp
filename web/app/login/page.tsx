"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { Loader, Lock, Camera, Fingerprint, Delete } from "lucide-react";

export default function LoginPage() {
    const { resolved } = useTheme();
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const { user, loading: authLoading, signInWithPin } = useAuth();
    const router = useRouter();

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (authLoading || loading) return;

            if (e.key >= "0" && e.key <= "9") {
                handlePinPress(e.key);
            } else if (e.key === "Backspace") {
                handleDelete();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [authLoading, loading, pin]); // Dependency on pin ensures it stays fresh if used internally

    // Redirect if already logged in
    useEffect(() => {
        if (!authLoading && user) {
            router.replace("/");
        }
    }, [user, authLoading, router]);

    const handlePinPress = (num: string) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === 4) {
                submitPin(newPin);
            }
        }
    };

    const handleDelete = () => {
        setPin(pin.slice(0, -1));
        setError(false);
    };

    const submitPin = async (finalPin: string) => {
        setLoading(true);
        const success = await signInWithPin(finalPin);
        if (!success) {
            setError(true);
            setPin("");
            // Haptic feedback shake would go here
            setTimeout(() => setError(false), 500);
        }
        setLoading(false);
    };

    if (authLoading || (user && !authLoading)) {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
                <Loader className="spin" color="var(--accent)" />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--bg)",
            backgroundImage: resolved === "dark"
                ? "radial-gradient(circle at center, var(--bg-subtle) 0%, var(--bg) 100%)"
                : "none",
            color: "var(--ink)",
            padding: "2rem",
            userSelect: "none"
        }}>
            {/* Header */}
            <div style={{ marginBottom: "2rem", textAlign: "center" }}>
                <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, var(--accent), var(--accent-2))`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1.5rem",
                    boxShadow: resolved === "dark" ? "0 0 30px var(--accent-soft)" : "none",
                    border: resolved === "light" ? "1px solid var(--line)" : "none",
                }}>
                    <Camera size={28} color={resolved === "dark" ? "#000" : "#fff"} />
                </div>
                <h1 style={{ fontSize: "1.25rem", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700 }}>Vault Access</h1>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>Enter PIN for Veer</p>
            </div>

            {/* PIN Dots */}
            <div style={{
                display: "flex",
                gap: "1.5rem",
                marginBottom: "3rem",
                transform: error ? "translateX(10px)" : "none",
                transition: "transform 0.1s ease"
            }}>
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: `2px solid ${error ? "var(--error)" : "var(--accent)"}`,
                        background: pin.length > i ? (error ? "var(--error)" : "var(--accent)") : "transparent",
                        boxShadow: pin.length > i ? `0 0 10px ${error ? "var(--error)" : "var(--accent)"}` : "none",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    }} />
                ))}
            </div>

            {/* Num Pad */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1.5rem",
                maxWidth: "280px"
            }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                        key={num}
                        onClick={() => handlePinPress(num)}
                        disabled={loading}
                        style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            border: "1px solid var(--line)",
                            background: "var(--bg-subtle)",
                            color: "var(--ink)",
                            fontSize: "1.5rem",
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.1s"
                        }}
                        onMouseDown={(e) => e.currentTarget.style.background = "var(--line)"}
                        onMouseUp={(e) => e.currentTarget.style.background = "var(--bg-subtle)"}
                    >
                        {num}
                    </button>
                ))}

                {/* Bottom Row */}
                <button
                    className="btn-icon"
                    onClick={() => { }} // Placeholder for Biometrics
                    style={{ background: "transparent", border: "none" }}
                    title="Touch ID / Face ID"
                >
                    <Fingerprint size={28} color="var(--muted)" />
                </button>

                <button
                    onClick={() => handlePinPress("0")}
                    disabled={loading}
                    style={{
                        width: "72px",
                        height: "72px",
                        borderRadius: "50%",
                        border: "1px solid var(--line)",
                        background: "var(--bg-subtle)",
                        color: "var(--ink)",
                        fontSize: "1.5rem",
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer"
                    }}
                >
                    0
                </button>

                <button
                    onClick={handleDelete}
                    style={{
                        width: "72px",
                        height: "72px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        color: "var(--muted)",
                        cursor: "pointer"
                    }}
                >
                    <Delete size={28} />
                </button>
            </div>

            {loading && (
                <div style={{ marginTop: "2rem" }}>
                    <Loader className="spin" size={24} color="var(--accent)" />
                </div>
            )}

            <p style={{ marginTop: "4rem", fontSize: "0.7rem", color: "var(--muted-2)", letterSpacing: "0.1em" }}>
                VEER'S PRIVATE VAULT
            </p>
        </div>
    );
}
