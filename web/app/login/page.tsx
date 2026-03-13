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
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "2rem 1.25rem",
        }}>
            <div style={{ width: "min(960px, 100%)", display: "grid", gap: "1rem" }}>
                <div className="page-grid-2" style={{ alignItems: "stretch" }}>
                    <section className="panel stack-md" style={{ minHeight: 420, justifyContent: "center" }}>
                        <div className="glass" style={{
                            width: 80,
                            height: 80,
                            borderRadius: 24,
                            display: "grid",
                            placeItems: "center",
                            marginBottom: '1rem'
                        }}>
                            <Camera size={32} color="var(--accent)" />
                        </div>
                        <div className="stack-sm">
                            <p className="section-heading">Private gallery</p>
                            <h1 style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.05 }}>Sign in to V-Pics</h1>
                            <p className="muted-copy">
                                Keep the auth flow simple: username + 4-digit PIN for normal sign-in, or quick unlock when the device already remembers you.
                            </p>
                        </div>
                        {/* Stats hidden for minimalism */}
                    </section>

                    <section className="panel stack-md" style={{ alignItems: "center", justifyContent: "center" }}>
                        <div className="stack-sm" style={{ alignItems: "center", textAlign: "center" }}>
                            <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                                {activeMode === "unlock" ? "Quick unlock" : activeMode === "signin" ? "Account sign in" : "Create account"}
                            </h2>
                            {activeMode === "unlock" && rememberedUsername ? (
                                <p className="muted-copy">
                                    Welcome back <strong>{rememberedUsername}</strong>
                                </p>
                            ) : (
                                <p className="muted-copy">
                                    {activeMode === "signin"
                                        ? "Enter your username and 4-digit PIN."
                                        : "Create a username, full name, and 4-digit PIN."}
                                </p>
                            )}
                        </div>

                        {error && (
                            <p style={{ color: "var(--error)", fontWeight: 600, fontSize: "0.85rem" }}>{error}</p>
                        )}

                        {activeMode === "unlock" && rememberedUsername ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                                <div style={{ display: "flex", gap: "0.9rem", marginBottom: "0.5rem" }}>
                                    {unlockDots.map((idx) => (
                                        <span
                                            key={idx}
                                            style={{
                                                width: 14,
                                                height: 14,
                                                borderRadius: "50%",
                                                border: "2px solid var(--accent)",
                                                background: unlockPin.length > idx ? "var(--accent)" : "transparent",
                                            }}
                                        />
                                    ))}
                                </div>
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 72px)",
                                    gap: "0.8rem",
                                }}>
                                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                                        <button
                                            key={digit}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => void handleUnlockDigit(digit)}
                                            className="btn"
                                            style={{ borderRadius: "999px", height: 56, minHeight: 56 }}
                                        >
                                            {digit}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className="btn"
                                        title="Biometric unlock is not enabled yet"
                                        disabled
                                        style={{ borderRadius: "999px", height: 56, minHeight: 56 }}
                                    >
                                        <Fingerprint size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => void handleUnlockDigit("0")}
                                        className="btn"
                                        style={{ borderRadius: "999px", height: 56, minHeight: 56 }}
                                    >
                                        0
                                    </button>
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={handleUnlockDelete}
                                        className="btn"
                                        style={{ borderRadius: "999px", height: 56, minHeight: 56 }}
                                    >
                                        <Delete size={16} />
                                    </button>
                                </div>
                                <button
                                    className="btn btn-secondary"
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
                            <div style={{ width: "100%", maxWidth: 360 }}>
                                {activeMode === "signin" ? (
                                    <form onSubmit={handleSignInSubmit} style={{ display: "grid", gap: "0.75rem" }}>
                                        <input
                                            value={signinUsername}
                                            onChange={(e) => setSigninUsername(e.target.value)}
                                            placeholder="Username"
                                            autoComplete="username"
                                            className="input"
                                        />
                                        <input
                                            value={signinPin}
                                            onChange={(e) => setSigninPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                                            placeholder="4-digit PIN"
                                            inputMode="numeric"
                                            autoComplete="current-password"
                                            className="input"
                                        />
                                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                                            {submitting ? <Loader size={16} className="spin" /> : "Sign In"}
                                        </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleSignUpSubmit} style={{ display: "grid", gap: "0.75rem" }}>
                                        <input
                                            value={signupUsername}
                                            onChange={(e) => setSignupUsername(e.target.value)}
                                            placeholder="Username (a-z, 0-9, _)"
                                            autoComplete="username"
                                            className="input"
                                        />
                                        <input
                                            value={signupFullName}
                                            onChange={(e) => setSignupFullName(e.target.value)}
                                            placeholder="Full name"
                                            autoComplete="name"
                                            className="input"
                                        />
                                        <input
                                            value={signupPin}
                                            onChange={(e) => setSignupPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                                            placeholder="Create 4-digit PIN"
                                            inputMode="numeric"
                                            autoComplete="new-password"
                                            className="input"
                                        />
                                        <input
                                            value={signupConfirmPin}
                                            onChange={(e) => setSignupConfirmPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                                            placeholder="Confirm PIN"
                                            inputMode="numeric"
                                            autoComplete="new-password"
                                            className="input"
                                        />
                                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                                            {submitting ? <Loader size={16} className="spin" /> : "Create Account"}
                                        </button>
                                    </form>
                                )}

                                <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        type="button"
                                        onClick={() => {
                                            setMode(activeMode === "signin" ? "signup" : "signin");
                                            setError(null);
                                        }}
                                    >
                                        {activeMode === "signin" ? "New user? Sign up" : "Already have an account? Sign in"}
                                    </button>
                                    {rememberedUsername && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            type="button"
                                            onClick={() => {
                                                setMode("unlock");
                                                setError(null);
                                            }}
                                        >
                                            Quick Unlock
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
