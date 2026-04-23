import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthHashResolver } from "@/components/auth-hash-resolver";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/supabase/server";

import { login } from "./actions";

function readParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionUser();

  if (session?.user) {
    redirect("/assignments");
  }

  const resolvedSearchParams = await searchParams;
  const message = readParam(resolvedSearchParams.message);
  const error = readParam(resolvedSearchParams.error);

  return (
    <AuthShell
      title="Sign in"
      description="Use email and password to access your grading workspace. Account access is managed by an administrator."
      message={message}
      error={error}
    >
      <AuthHashResolver />

      <form className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="email" className="caps">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", background: "var(--bg)" }}
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="password" className="caps">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", background: "var(--bg)" }}
          />
        </div>

        <div className="mt-2 grid gap-3">
          <button formAction={login} className="btn btn-primary" type="submit">
            Sign in
          </button>
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm" style={{ color: "var(--ink-2)" }}>
        <span>Need to reset your password?</span>
        <Link href="/forgot-password" style={{ color: "var(--accent)" }}>
          Forgot password
        </Link>
      </div>
    </AuthShell>
  );
}
