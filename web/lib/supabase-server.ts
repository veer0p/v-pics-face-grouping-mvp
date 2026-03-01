import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSupabaseUrl(): string {
  return mustEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function getSupabaseAnonKey(): string {
  return mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

function getServiceRoleKey(): string {
  return mustEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function createServiceClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createAnonClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * request-aware Supabase client that uses cookies to identify the user.
 * Best for API routes and Server Components.
 */
export async function createRequestClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Get the current authenticated profile based on the cookie.
 */
export async function getAuthenticatedProfile() {
  const cookieStore = await cookies();
  const profileId = cookieStore.get("v-pics-session")?.value;

  if (!profileId) return null;

  const supabase = createServiceClient(); // Service role for internal check
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error || !data) return null;
  return data;
}
