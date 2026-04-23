import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getDefaultNextPath(type: EmailOtpType | null) {
  if (type === "invite") {
    return "/reset-password?mode=invite";
  }

  if (type === "recovery") {
    return "/reset-password?mode=recovery";
  }

  return "/assignments";
}

function sanitizeNextPath(value: string | null, type: EmailOtpType | null) {
  if (!value || !value.startsWith("/")) {
    return getDefaultNextPath(type);
  }

  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNextPath(searchParams.get("next"), type);
  const redirectTo = request.nextUrl.clone();
  const nextUrl = new URL(next, request.nextUrl.origin);

  redirectTo.pathname = nextUrl.pathname;
  redirectTo.search = nextUrl.search;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/auth/error";
  errorUrl.search = "";
  errorUrl.searchParams.set("error", "access_denied");
  errorUrl.searchParams.set(
    "error_description",
    "The confirmation link is invalid or has expired.",
  );

  if (type) {
    errorUrl.searchParams.set("type", type);
  }

  return NextResponse.redirect(errorUrl);
}
