function getStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
    if (typeof window === "undefined") return null;

    try {
        return window[kind];
    } catch {
        return null;
    }
}

export function safeLocalStorageGet(key: string): string | null {
    try {
        return getStorage("localStorage")?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

export function safeLocalStorageSet(key: string, value: string) {
    try {
        getStorage("localStorage")?.setItem(key, value);
    } catch {
        // Ignore storage failures and continue with in-memory state.
    }
}

export function safeLocalStorageRemove(key: string) {
    try {
        getStorage("localStorage")?.removeItem(key);
    } catch {
        // Ignore storage failures and continue with in-memory state.
    }
}

export function safeSessionStorageGet(key: string): string | null {
    try {
        return getStorage("sessionStorage")?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

export function safeSessionStorageSet(key: string, value: string) {
    try {
        getStorage("sessionStorage")?.setItem(key, value);
    } catch {
        // Ignore storage failures and continue with in-memory state.
    }
}

export function safeSessionStorageRemove(key: string) {
    try {
        getStorage("sessionStorage")?.removeItem(key);
    } catch {
        // Ignore storage failures and continue with in-memory state.
    }
}
