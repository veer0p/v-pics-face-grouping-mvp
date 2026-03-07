const AVATAR_KEY_PREFIX = "avatars/";

export function isAvatarObjectKey(value: string | null | undefined): value is string {
    return typeof value === "string" && value.startsWith(AVATAR_KEY_PREFIX);
}

export function toAvatarProxyUrl(key: string): string {
    return `/api/profile/avatar?key=${encodeURIComponent(key)}`;
}

export function resolveAvatarUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    if (isAvatarObjectKey(value)) {
        return toAvatarProxyUrl(value);
    }
    return value;
}

