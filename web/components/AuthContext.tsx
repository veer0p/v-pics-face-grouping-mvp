"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from "@/lib/browser-storage";

type UserProfile = {
    id: string;
    full_name: string;
    username?: string;
    avatar_url?: string | null;
};

type AuthContextType = {
    user: UserProfile | null;
    loading: boolean;
    signInWithPin: (pin: string, username?: string) => Promise<boolean>;
    signUpWithPin: (payload: { username: string; fullName: string; pin: string }) => Promise<{ ok: boolean; error?: string }>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    updateUser: (patch: Partial<UserProfile>) => void;
    rememberedUsername: string | null;
    clearRememberedUsername: () => void;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithPin: async () => false,
    signUpWithPin: async () => ({ ok: false, error: "Not initialized" }),
    signOut: async () => { },
    refreshUser: async () => { },
    updateUser: () => { },
    rememberedUsername: null,
    clearRememberedUsername: () => { },
});

const REMEMBERED_USERNAME_KEY = "v-pics-last-username";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [rememberedUsername, setRememberedUsername] = useState<string | null>(() => {
        return safeLocalStorageGet(REMEMBERED_USERNAME_KEY);
    });

    const setRemembered = useCallback((username: string | null) => {
        if (typeof window === "undefined") return;
        if (!username) {
            safeLocalStorageRemove(REMEMBERED_USERNAME_KEY);
            setRememberedUsername(null);
            return;
        }
        safeLocalStorageSet(REMEMBERED_USERNAME_KEY, username);
        setRememberedUsername(username);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me", { cache: "no-store" });
            if (!res.ok) {
                setUser(null);
                return;
            }
            const payload = await res.json();
            setUser(payload.user || null);
            if (payload?.user?.username) {
                setRemembered(payload.user.username);
            }
        } catch {
            setUser(null);
        }
    }, [setRemembered]);

    useEffect(() => {
        void (async () => {
            await refreshUser();
            setLoading(false);
        })();
    }, [refreshUser]);

    const signInWithPin = async (pin: string, username?: string) => {
        setLoading(true);
        try {
            const hasExplicitUsername = !!username?.trim();
            const preferredUsername = (username?.trim() || rememberedUsername || "").toLowerCase();
            if (!preferredUsername) {
                setLoading(false);
                return false;
            }

            const route = hasExplicitUsername ? "/api/auth/login" : "/api/auth/quick-unlock";
            const response = await fetch(route, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: preferredUsername, pin }),
            });
            if (!response.ok) {
                setLoading(false);
                return false;
            }
            const payload = await response.json();
            setUser(payload.user || null);
            setRemembered(preferredUsername);
            setLoading(false);
            return true;
        } catch {
            setLoading(false);
            return false;
        }
    };

    const signUpWithPin = async (payload: { username: string; fullName: string; pin: string }) => {
        setLoading(true);
        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                setLoading(false);
                return { ok: false, error: data?.error || "Signup failed." };
            }

            setUser(data.user || null);
            if (data?.user?.username) setRemembered(data.user.username);
            setLoading(false);
            return { ok: true };
        } catch {
            setLoading(false);
            return { ok: false, error: "Network error." };
        }
    };

    const signOut = async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => { });
        setUser(null);
        setLoading(false);
    };

    const updateUser = (patch: Partial<UserProfile>) => {
        setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    const clearRememberedUsername = () => {
        setRemembered(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            signInWithPin,
            signUpWithPin,
            signOut,
            refreshUser,
            updateUser,
            rememberedUsername,
            clearRememberedUsername,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
