import { createBrowserClient } from "@supabase/ssr";

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  return value;
}

function getSupabasePublishableKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  return value;
}

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
