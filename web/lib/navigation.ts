import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { safeSessionStorageGet, safeSessionStorageSet } from "@/lib/browser-storage";

const NAV_PREVIOUS_KEY = "vp_nav_previous";
const NAV_CURRENT_KEY = "vp_nav_current";

function isUsablePath(path: string | null | undefined) {
    if (!path) return false;
    if (!path.startsWith("/")) return false;
    if (path.startsWith("/login")) return false;
    return true;
}

export function trackInternalRoute(path: string) {
    if (typeof window === "undefined" || !isUsablePath(path)) return;

    const current = safeSessionStorageGet(NAV_CURRENT_KEY);
    if (current === path) return;

    if (isUsablePath(current)) {
        safeSessionStorageSet(NAV_PREVIOUS_KEY, current as string);
    }

    safeSessionStorageSet(NAV_CURRENT_KEY, path);
}

export function getSafeBackTarget(currentPath?: string) {
    const current = currentPath || (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "");
    const previous = safeSessionStorageGet(NAV_PREVIOUS_KEY);

    if (!isUsablePath(previous) || previous === current) {
        return null;
    }

    return previous;
}

export function navigateBackOr(router: AppRouterInstance, fallback: string, currentPath?: string) {
    const target = getSafeBackTarget(currentPath);
    router.push(target || fallback);
}
