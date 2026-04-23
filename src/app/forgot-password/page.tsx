import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/supabase/server";

import { sendResetLink } from "./actions";

function readParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({
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
      title="Reset password"
      description="Enter the email for your account. The reset link will route back through the app so Supabase can establish a recovery session."
      message={message}
      error={error}
    >
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

        <button formAction={sendResetLink} className="btn btn-primary" type="submit">
          Send reset link
        </button>
      </form>

      <div className="mt-5 text-sm" style={{ color: "var(--ink-2)" }}>
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
