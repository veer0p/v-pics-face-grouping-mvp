import { createClient } from "@supabase/supabase-js";

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
