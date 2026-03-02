"use client";
// Forced rebuild for PIN-auth transition

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type UserProfile = {
    id: string;
    full_name: string;
    avatar_url?: string;
};

type AuthContextType = {
    user: UserProfile | null;
    loading: boolean;
    signInWithPin: (pin: string) => Promise<boolean>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    updateUser: (patch: Partial<UserProfile>) => void;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithPin: async () => false,
    signOut: async () => { },
    refreshUser: async () => { },
    updateUser: () => { },
});

const COOKIE_NAME = "v-pics-session";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = getSupabaseBrowser();

    const fetchUserById = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();
        if (error || !data) return null;
        return data as UserProfile;
    }, [supabase]);

    // Helper to get cookie
    const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift();
        return null;
    };

    // Helper to set cookie
    const setCookie = (name: string, value: string, days = 7) => {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
    };

    // Helper to remove cookie
    const removeCookie = (name: string) => {
        // More thorough cookie removal
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    };

    useEffect(() => {
        const checkSession = async () => {
            const userId = getCookie(COOKIE_NAME);
            if (userId) {
                try {
                    const profile = await fetchUserById(userId);
                    if (profile) {
                        setUser(profile);
                    } else {
                        removeCookie(COOKIE_NAME);
                    }
                } catch {
                    removeCookie(COOKIE_NAME);
                }
            }
            setLoading(false);
        };

        checkSession();
    }, [fetchUserById]);

    const signInWithPin = async (pin: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("pin", pin)
            .single();

        if (data && !error) {
            setUser(data);
            setCookie(COOKIE_NAME, data.id);
            setLoading(false);
            return true;
        }

        setLoading(false);
        return false;
    };

    const signOut = async () => {
        console.log("[AUTH] Signing out...");
        setUser(null);
        removeCookie(COOKIE_NAME);
        // We'll let the caller handle redirect for better control, 
        // but we'll provide a fallback to home if nothing happens
        setLoading(false);
    };

    const refreshUser = async () => {
        const userId = getCookie(COOKIE_NAME);
        if (!userId) {
            setUser(null);
            return;
        }
        const profile = await fetchUserById(userId);
        if (profile) {
            setUser(profile);
        }
    };

    const updateUser = (patch: Partial<UserProfile>) => {
        setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithPin, signOut, refreshUser, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
