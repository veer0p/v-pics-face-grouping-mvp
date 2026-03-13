"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Delete, Fingerprint, Loader } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

type Mode = "unlock" | "signin" | "signup";

function isPinValid(pin: string) {
    return /^\d{4}$/.test(pin);
}

export default function LoginPage() {
    const router = useRouter();
    const {
        user,
        loading: authLoading,
        signInWithPin,
        signUpWithPin,
        rememberedUsername,
        clearRememberedUsername,
    } = useAuth();

    const [mode, setMode] = useState<Mode>(rememberedUsername ? "unlock" : "signin");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [unlockPin, setUnlockPin] = useState("");
    const [signinUsername, setSigninUsername] = useState(rememberedUsername || "");
    const [signinPin, setSigninPin] = useState("");
    const [signupUsername, setSignupUsername] = useState("");
    const [signupFullName, setSignupFullName] = useState("");
    const [signupPin, setSignupPin] = useState("");
    const [signupConfirmPin, setSignupConfirmPin] = useState("");

    useEffect(() => {
        if (!authLoading && user) {
            router.replace("/");
        }
    }, [authLoading, router, user]);

    const unlockDots = useMemo(() => [0, 1, 2, 3], []);
    const activeMode: Mode = mode === "unlock" && !rememberedUsername ? "signin" : mode;

    const handleUnlockDigit = async (digit: string) => {
        if (submitting || unlockPin.length >= 4) return;
        const next = `${unlockPin}${digit}`;
        setUnlockPin(next);
        setError(null);

        if (next.length === 4) {
            setSubmitting(true);
            const ok = await signInWithPin(next);
            if (!ok) {
                setError("Invalid PIN.");
                setUnlockPin("");
            }
            setSubmitting(false);
        }
    };

    const handleUnlockDelete = () => {
        if (submitting) return;
        setUnlockPin((prev) => prev.slice(0, -1));
        setError(null);
    };

    const handleSignInSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!isPinValid(signinPin)) {
            setError("PIN must be exactly 4 digits.");
            return;
        }
        setSubmitting(true);
        setError(null);
        const ok = await signInWithPin(signinPin, signinUsername);
        if (!ok) setError("Invalid username or PIN.");
        setSubmitting(false);
    };

    const handleSignUpSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!signupUsername.trim()) {
            setError("Username is required.");
            return;
        }
        if (!signupFullName.trim()) {
            setError("Full name is required.");
            return;
        }
        if (!isPinValid(signupPin)) {
            setError("PIN must be exactly 4 digits.");
            return;
        }
        if (signupPin !== signupConfirmPin) {
            setError("PIN confirmation does not match.");
            return;
        }

        setSubmitting(true);
        setError(null);
        const result = await signUpWithPin({
            username: signupUsername,
            fullName: signupFullName,
            pin: signupPin,
        });
        if (!result.ok) {
            setError(result.error || "Failed to create account.");
        }
        setSubmitting(false);
    };

    if (authLoading || (user && !authLoading)) {
        return (
            <div style={{ height: "100vh", display: "grid", placeItems: "center" }}>
                <Loader className="spin" color="var(--accent)" />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: "1.5rem 1.25rem",
            background: "var(--bg)",
            color: "var(--ink)",
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Ambient Background Glows */}
            <div style={{
                position: "absolute",
                top: "-10%",
                left: "-10%",
                width: "40vw",
                height: "40vw",
                background: "radial-gradient(circle, rgba(255, 0, 127, 0.1) 0%, transparent 70%)",
                filter: "blur(60px)",
                zIndex: 0
            }} />
            <div style={{
                position: "absolute",
                bottom: "-10%",
                right: "-10%",
                width: "40vw",
                height: "40vw",
                background: "radial-gradient(circle, rgba(255, 0, 127, 0.1) 0%, transparent 70%)",
                filter: "blur(60px)",
                zIndex: 0
            }} />

            <div style={{
                width: "min(420px, 100%)",
                position: "relative",
                zIndex: 1,
                perspective: "1000px"
            }}>
                <section style={{
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(var(--glass-blur))",
                    WebkitBackdropFilter: "blur(var(--glass-blur))",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "32px",
                    padding: "2.5rem 2rem",
                    boxShadow: "var(--shadow-md), var(--shadow-lg)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1.5rem",
                    width: "100%"
                }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 18,
                        background: "var(--accent)",
                        boxShadow: "var(--accent-glow)",
                        display: "grid",
                        placeItems: "center",
                    }}>
                        <Camera size={32} color="#fff" />
                    </div>

                    <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                        <h1 style={{
                            fontSize: "1.75rem",
                            fontWeight: 700,
                            marginBottom: "0.5rem",
                            letterSpacing: "-0.02em"
                        }}>
                            {activeMode === "unlock" ? "Quick Unlock" : activeMode === "signin" ? "Sign in to V-Pics" : "Create Account"}
                        </h1>
                        {activeMode === "unlock" && rememberedUsername ? (
                            <p style={{ color: "var(--ink-2)", fontSize: "0.95rem" }}>
                                Welcome back, <strong style={{ color: "var(--accent)" }}>{rememberedUsername}</strong>
                            </p>
                        ) : (
                            <p style={{ color: "var(--ink-2)", fontSize: "0.9rem" }}>
                                {activeMode === "signin"
                                    ? "Enter your credentials to continue"
                                    : "Join the private gallery today"}
                            </p>
                        )}
                    </div>

                    {error && (
                        <div style={{
                            width: "100%",
                            padding: "0.75rem",
                            borderRadius: "12px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            color: "#ef4444",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            textAlign: "center"
                        }}>
                            {error}
                        </div>
                    )}

                    {activeMode === "unlock" && rememberedUsername ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem", width: "100%" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                {unlockDots.map((idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: "50%",
                                            border: "2px solid var(--accent)",
                                            background: unlockPin.length > idx ? "var(--accent)" : "transparent",
                                            boxShadow: unlockPin.length > idx ? "0 0 10px var(--accent)" : "none",
                                            transition: "all 0.2s ease"
                                        }}
                                    />
                                ))}
                            </div>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: "1rem",
                                width: "100%"
                            }}>
                                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                                    <button
                                        key={digit}
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => void handleUnlockDigit(digit)}
                                        style={{
                                            borderRadius: "16px",
                                            height: 64,
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            color: "var(--ink)",
                                            fontSize: "1.25rem",
                                            fontWeight: 600,
                                            transition: "all 0.2s ease",
                                            cursor: "pointer"
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                            e.currentTarget.style.borderColor = "var(--line)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                                        }}
                                    >
                                        {digit}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    disabled
                                    style={{ borderRadius: "16px", height: 64, opacity: 0.3, background: "none", border: "none" }}
                                >
                                    <Fingerprint size={24} color="var(--ink)" />
                                </button>
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => void handleUnlockDigit("0")}
                                    style={{
                                        borderRadius: "16px",
                                        height: 64,
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "var(--ink)",
                                        fontSize: "1.25rem",
                                        fontWeight: 600,
                                        transition: "all 0.2s ease",
                                        cursor: "pointer"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                        e.currentTarget.style.borderColor = "var(--line)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                                    }}
                                >
                                    0
                                </button>
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={handleUnlockDelete}
                                    style={{
                                        borderRadius: "16px",
                                        height: 64,
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "var(--ink)",
                                        display: "grid",
                                        placeItems: "center",
                                        transition: "all 0.2s ease",
                                        cursor: "pointer"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                        e.currentTarget.style.borderColor = "var(--line)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                                    }}
                                >
                                    <Delete size={20} />
                                </button>
                            </div>
                            <button
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--muted)",
                                    fontSize: "0.85rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    textDecoration: "underline"
                                }}
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                    clearRememberedUsername();
                                    setMode("signin");
                                    setUnlockPin("");
                                    setError(null);
                                }}
                            >
                                Use Different Account
                            </button>
                        </div>
                    ) : (
                        <div style={{ width: "100%" }}>
                            {activeMode === "signin" ? (
                                <form onSubmit={handleSignInSubmit} style={{ display: "grid", gap: "1.25rem" }}>
                                    <div style={{ display: "grid", gap: "0.5rem" }}>
                                        <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>Username</label>
                                        <input
                                            value={signinUsername}
                                            onChange={(e) => setSigninUsername(e.target.value)}
                                            placeholder="Enter username"
                                            autoComplete="username"
                                            style={{
                                                background: "rgba(255,255,255,0.05)",
                                                border: "1px solid var(--line)",
                                                borderRadius: "12px",
                                                padding: "0.8rem 1rem",
                                                color: "var(--ink)",
                                                fontSize: "0.95rem",
                                                outline: "none"
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: "grid", gap: "0.5rem" }}>
                                        <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>4-Digit PIN</label>
                                        <input
                                            value={signinPin}
                                            onChange={(e) => setSigninPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                                            placeholder="••••"
                                            inputMode="numeric"
                                            type="password"
                                            autoComplete="current-password"
                                            style={{
                                                background: "rgba(255,255,255,0.05)",
                                                border: "1px solid var(--line)",
                                                borderRadius: "12px",
                                                padding: "0.8rem 1rem",
                                                color: "var(--ink)",
                                                fontSize: "1.1rem",
                                                letterSpacing: "0.3em",
                                                outline: "none"
                                            }}
                                        />
                                    </div>
                                    <button
                                        style={{
                                            background: "var(--accent)",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "12px",
                                            padding: "1rem",
                                            fontSize: "1rem",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            marginTop: "0.5rem",
                                            boxShadow: "var(--accent-glow)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "transform 0.2s ease"
                                        }}
                                        type="submit"
                                        disabled={submitting}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                                    >
                                        {submitting ? <Loader size={20} className="spin" /> : "Sign In"}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleSignUpSubmit} style={{ display: "grid", gap: "1rem" }}>
                                    <input
                                        value={signupUsername}
                                        onChange={(e) => setSignupUsername(e.target.value)}
                                        placeholder="Username"
                                        style={{
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid var(--line)",
                                            borderRadius: "12px",
                                            padding: "0.8rem 1rem",
                                            color: "var(--ink)",
                                            fontSize: "0.95rem",
                                            outline: "none"
                                        }}
                                    />
                                    <input
                                        value={signupFullName}
                                        onChange={(e) => setSignupFullName(e.target.value)}
                                        placeholder="Full Name"
                                        style={{
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid var(--line)",
                                            borderRadius: "12px",
                                            padding: "0.8rem 1rem",
                                            color: "var(--ink)",
                                            fontSize: "0.95rem",
                                            outline: "none"
                                        }}
                                    />
                                    <input
                                        value={signupPin}
                                        onChange={(e) => setSignupPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                                        placeholder="4-digit PIN"
                                        inputMode="numeric"
                                        type="password"
                                        style={{
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid var(--line)",
                                            borderRadius: "12px",
                                            padding: "0.8rem 1rem",
                                            color: "var(--ink)",
                                            fontSize: "0.95rem",
                                            outline: "none"
                                        }}
                                    />
                                    <input
                                        value={signupConfirmPin}
                                        onChange={(e) => setSignupConfirmPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                                        placeholder="Confirm PIN"
                                        inputMode="numeric"
                                        type="password"
                                        style={{
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid var(--line)",
                                            borderRadius: "12px",
                                            padding: "0.8rem 1rem",
                                            color: "var(--ink)",
                                            fontSize: "0.95rem",
                                            outline: "none"
                                        }}
                                    />
                                    <button
                                        style={{
                                            background: "var(--accent)",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "12px",
                                            padding: "1rem",
                                            fontSize: "1rem",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            marginTop: "0.5rem",
                                            boxShadow: "var(--accent-glow)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "transform 0.2s ease"
                                        }}
                                        type="submit"
                                        disabled={submitting}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                                    >
                                        {submitting ? <Loader size={20} className="spin" /> : "Create Account"}
                                    </button>
                                </form>
                            )}

                            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                                <button
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--accent)",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                    type="button"
                                    onClick={() => {
                                        setMode(activeMode === "signin" ? "signup" : "signin");
                                        setError(null);
                                    }}
                                >
                                    {activeMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
