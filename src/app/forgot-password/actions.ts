"use server";

import { redirect } from "next/navigation";

import { getSiteUrl } from "@/app/brand";
import { createClient } from "@/lib/supabase/server";

function redirectWith(path: string, key: "error" | "message", value: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

export async function sendResetLink(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    redirectWith("/forgot-password", "error", "Email is required.");
  }

  const confirmUrl = new URL("/auth/confirm", getSiteUrl());
  confirmUrl.searchParams.set("next", "/reset-password");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl.toString(),
  });

  if (error) {
    redirectWith("/forgot-password", "error", error.message);
  }

  redirectWith(
    "/forgot-password",
    "message",
    "If that email exists, a password reset link has been sent.",
  );
}
