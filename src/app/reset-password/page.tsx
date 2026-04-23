import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/supabase/server";

import { updatePassword } from "./actions";

function readParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionUser();

  if (!session?.user) {
    redirect("/login?error=Your+reset+link+has+expired.+Request+a+new+one.");
  }

  const resolvedSearchParams = await searchParams;
  const message = readParam(resolvedSearchParams.message);
  const error = readParam(resolvedSearchParams.error);

  return (
    <AuthShell
      title="Choose a new password"
      description="Your recovery session is active. Save a new password to continue into the grading workspace."
      message={message}
      error={error}
    >
      <form className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="password" className="caps">
            New password
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

        <div className="grid gap-1.5">
          <label htmlFor="confirmPassword" className="caps">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            className="rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{ borderColor: "var(--line)", background: "var(--bg)" }}
          />
        </div>

        <button formAction={updatePassword} className="btn btn-primary" type="submit">
          Update password
        </button>
      </form>

      <div className="mt-5 text-sm" style={{ color: "var(--ink-2)" }}>
        <Link href="/assignments" style={{ color: "var(--accent)" }}>
          Back to assignments
        </Link>
      </div>
    </AuthShell>
  );
}
