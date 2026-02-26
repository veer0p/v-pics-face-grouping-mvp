"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
    theme: Theme;
    setTheme: (t: Theme) => void;
    resolved: "light" | "dark";
}>({ theme: "system", setTheme: () => { }, resolved: "light" });

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("system");
    const [resolved, setResolved] = useState<"light" | "dark">("light");

    useEffect(() => {
        const saved = localStorage.getItem("vpics-theme") as Theme | null;
        if (saved) setThemeState(saved);
    }, []);

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

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem("vpics-theme", t);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
            {children}
        </ThemeContext.Provider>
    );
}
