import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export interface AuthenticatedSupabaseContext {
  supabase: SupabaseClient;
  user: User;
}

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

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Cookie writes from Server Components can be ignored when proxy refresh is enabled.
        }
      },
    },
  });
}

export async function getSessionUser(): Promise<AuthenticatedSupabaseContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.message === "Auth session missing!") {
      return null;
    }
    throw new Error(error.message);
  }

  return user ? { supabase, user } : null;
}

export async function requireSessionUser(): Promise<AuthenticatedSupabaseContext> {
  const context = await getSessionUser();

  if (!context) {
    throw new Error("Authentication required.");
  }

  return context;
}
