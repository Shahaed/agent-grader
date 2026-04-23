"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function redirectWith(path: string, key: "error" | "message", value: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!password || !confirmPassword) {
    redirectWith("/reset-password", "error", "Both password fields are required.");
  }

  if (password.length < 8) {
    redirectWith("/reset-password", "error", "Use at least 8 characters.");
  }

  if (password !== confirmPassword) {
    redirectWith("/reset-password", "error", "Passwords do not match.");
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirectWith("/reset-password", "error", error.message);
  }

  revalidatePath("/", "layout");
  redirect("/assignments");
}
