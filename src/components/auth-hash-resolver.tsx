"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

function buildErrorUrl(params: URLSearchParams) {
  const url = new URL("/auth/error", window.location.origin);

  for (const key of ["error", "error_code", "error_description", "type"]) {
    const value = params.get(key);

    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function getDestination(type: string | null) {
  if (type === "invite") {
    return "/reset-password?mode=invite";
  }

  if (type === "recovery") {
    return "/reset-password?mode=recovery";
  }

  return "/assignments";
}

function getStatusMessage(type: string | null) {
  if (type === "invite") {
    return "Opening your invitation...";
  }

  if (type === "recovery") {
    return "Opening password reset...";
  }

  return "Completing sign-in...";
}

export function AuthHashResolver() {
  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";

    if (!hash) {
      return;
    }

    const params = new URLSearchParams(hash);
    const error = params.get("error");

    if (error) {
      window.location.replace(buildErrorUrl(params));
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      return;
    }

    const type = params.get("type");
    const statusMessage = getStatusMessage(type);
    const title = document.title;
    document.title = `${statusMessage} | Agent Grader`;

    const supabase = createClient();

    void (async () => {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        const errorParams = new URLSearchParams({
          error: "access_denied",
          error_description: sessionError.message,
        });

        if ("code" in sessionError && typeof sessionError.code === "string") {
          errorParams.set("error_code", sessionError.code);
        }

        if (type) {
          errorParams.set("type", type);
        }

        window.location.replace(buildErrorUrl(errorParams));
        return;
      }

      window.location.replace(getDestination(type));
    })();

    return () => {
      document.title = title;
    };
  }, []);
  return null;
}
