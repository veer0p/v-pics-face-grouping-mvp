import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hashSessionToken, parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth-server";

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
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawCookie) return null;

  const supabase = createServiceClient();
  const parsed = parseSessionCookieValue(rawCookie);

  // Backward compatibility: legacy cookie stored plain user_id.
  if (!parsed) {
    const { data: legacyUser, error: legacyError } = await supabase
      .from("users")
      .select("*")
      .eq("id", rawCookie)
      .maybeSingle();

    if (legacyError || !legacyUser) return null;
    return legacyUser;
  }

  const tokenHash = hashSessionToken(parsed.token);
  const nowIso = new Date().toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("auth_sessions")
    .select("id, user_id, expires_at, revoked_at")
    .eq("id", parsed.sessionId)
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .single();

  if (sessionError || !session) return null;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.user_id)
    .single();

  if (userError || !user) return null;
  return user;
}

export async function getActiveSession() {
  const cookieStore = await cookies();
  const parsed = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!parsed) return null;

  const supabase = createServiceClient();
  const tokenHash = hashSessionToken(parsed.token);
  const nowIso = new Date().toISOString();

  const { data: session, error } = await supabase
    .from("auth_sessions")
    .select("*")
    .eq("id", parsed.sessionId)
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .single();

  if (error || !session) return null;
  return session;
}
