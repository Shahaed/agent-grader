import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({
            request,
          });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}
