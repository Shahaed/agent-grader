"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function redirectWith(path: string, key: "error" | "message", value: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirectWith("/login", "error", "Email and password are required.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWith("/login", "error", error.message);
  }

  revalidatePath("/", "layout");
  redirect("/assignments");
}
