import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Browser-safe Supabase client using public (anon) credentials.
 * Uses a singleton so the same client + Realtime connection is reused.
 */
export function getSupabaseBrowser(): SupabaseClient {
    if (_client) return _client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        // Provide dummy values to prevent build/prerender crashes
        // This is safe because these values are not used for actual data fetching during static generation
        const dummyUrl = "https://dummy.supabase.co";
        const dummyKey = "dummy-key";

        _client = createClient(dummyUrl, dummyKey, {
            realtime: {
                params: { eventsPerSecond: 10 },
            },
        });
        return _client;
    }

    _client = createClient(url, anonKey, {
        realtime: {
            params: { eventsPerSecond: 10 },
        },
    });

    return _client;
}
