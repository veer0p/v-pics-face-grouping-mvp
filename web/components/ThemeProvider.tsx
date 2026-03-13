"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ACCENT_PALETTES } from "@/lib/palettes";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/browser-storage";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (t: Theme) => void;
    resolved: "light" | "dark";
    accentIndex: number;
    setAccentIndex: (i: number) => void;
}>({
    theme: "system", setTheme: () => { }, resolved: "light",
    accentIndex: 0, setAccentIndex: () => { }
});

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");
    const [resolved, setResolved] = useState<"light" | "dark">("light");
    const [accentIndex, setAccentIndexState] = useState(0);

    useEffect(() => {
        const savedTheme = safeLocalStorageGet("vpics-theme") as Theme | null;
        if (savedTheme) setThemeState(savedTheme);

        const savedAccent = safeLocalStorageGet("vpics-accent");
        if (savedAccent) setAccentIndexState(parseInt(savedAccent, 10));
    }, []);

    // Apply base theme (light/dark)
    useEffect(() => {
        const apply = (t: Theme) => {
            let r: "light" | "dark";
            if (t === "system") {
                r = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            } else {
                r = t;
            }
            setResolved(r);
            document.documentElement.setAttribute("data-theme", r);
        };
        apply(theme);

        if (theme === "system") {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = () => apply("system");
            mq.addEventListener("change", handler);
            return () => mq.removeEventListener("change", handler);
        }
    }, [theme]);

    // Apply dynamic accent colors
    useEffect(() => {
        const palette = ACCENT_PALETTES[resolved][accentIndex] || ACCENT_PALETTES[resolved][0];
        const root = document.documentElement;

        root.style.setProperty("--accent", palette.accent);
        root.style.setProperty("--accent-2", palette.accent2);
        root.style.setProperty("--accent-soft", palette.accentSoft);
        root.style.setProperty("--glow-color", palette.glow);

        // Deep Theme Customization
        root.style.setProperty("--ink", palette.ink);
        root.style.setProperty("--ink-2", palette.ink2);
        root.style.setProperty("--muted", palette.muted);
        root.style.setProperty("--muted-2", palette.muted2);
        root.style.setProperty("--bg", palette.bg);
        root.style.setProperty("--bg-elevated", palette.bgElevated);
        root.style.setProperty("--bg-subtle", palette.bgSubtle);
        root.style.setProperty("--line", palette.line);
        root.style.setProperty("--line-strong", palette.lineStrong);

        // Update glow shadow if it exists
        if (palette.glow !== "transparent") {
            root.style.setProperty("--glow-shadow", `0 0 15px -2px ${palette.glow}`);
        } else {
            root.style.setProperty("--glow-shadow", "none");
        }
    }, [resolved, accentIndex]);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        safeLocalStorageSet("vpics-theme", t);
    };

    const setAccentIndex = (i: number) => {
        setAccentIndexState(i);
        safeLocalStorageSet("vpics-accent", i.toString());
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolved, accentIndex, setAccentIndex }}>
            {children}
        </ThemeContext.Provider>
    );
}
