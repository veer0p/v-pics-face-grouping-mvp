import { normalizeUsername } from "@/lib/auth-server";
import { createServiceClient } from "@/lib/supabase-server";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type AuthLoginUser = {
    id: string;
    full_name: string;
    username: string | null;
    avatar_url: string | null;
    pin_hash: string | null;
    pin: string | null;
};

const MODERN_SELECT = "id, full_name, username, avatar_url, pin_hash, pin";
const LEGACY_SELECT = "id, full_name, avatar_url, pin";

function toLoginUser(
    row: Partial<AuthLoginUser> & { id: string; full_name: string },
    fallbackUsername: string,
): AuthLoginUser {
    return {
        id: row.id,
        full_name: row.full_name,
        username: row.username ?? fallbackUsername,
        avatar_url: row.avatar_url ?? null,
        pin_hash: row.pin_hash ?? null,
        pin: row.pin ?? null,
    };
}

export async function findAuthUserByIdentifier(
    supabase: ServiceClient,
    usernameInput: string,
): Promise<AuthLoginUser | null> {
    const username = normalizeUsername(usernameInput);
    if (!username) return null;

    const byUsernameExact = await supabase
        .from("users")
        .select(MODERN_SELECT)
        .eq("username", username)
        .maybeSingle();

    if (!byUsernameExact.error && byUsernameExact.data) {
        return toLoginUser(byUsernameExact.data as AuthLoginUser, username);
    }

    const missingModernColumns = byUsernameExact.error?.code === "42703";

    if (!missingModernColumns) {
        const byUsernameCaseInsensitive = await supabase
            .from("users")
            .select(MODERN_SELECT)
            .ilike("username", username)
            .maybeSingle();

        if (!byUsernameCaseInsensitive.error && byUsernameCaseInsensitive.data) {
            return toLoginUser(byUsernameCaseInsensitive.data as AuthLoginUser, username);
        }

        const byFullName = await supabase
            .from("users")
            .select(MODERN_SELECT)
            .ilike("full_name", username)
            .maybeSingle();

        if (!byFullName.error && byFullName.data) {
            return toLoginUser(byFullName.data as AuthLoginUser, username);
        }
    }

    const legacyByName = await supabase
        .from("users")
        .select(LEGACY_SELECT)
        .ilike("full_name", username)
        .maybeSingle();

    if (legacyByName.error || !legacyByName.data) {
        return null;
    }

    return toLoginUser(legacyByName.data as AuthLoginUser, username);
}

