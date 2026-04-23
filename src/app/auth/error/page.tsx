import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";

function readParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorCopy(errorCode?: string) {
  if (errorCode === "otp_expired") {
    return {
      title: "Link expired",
      description:
        "This email link is no longer valid. Ask for a fresh invite or reset email, then open the newest message.",
    };
  }

  return {
    title: "Authentication error",
    description:
      "We could not complete that sign-in link. Start again from the latest email or return to the sign-in page.",
  };
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = readParam(resolvedSearchParams.error);
  const errorCode = readParam(resolvedSearchParams.error_code);
  const errorDescription = readParam(resolvedSearchParams.error_description);
  const { title, description } = getErrorCopy(errorCode);

  return (
    <AuthShell title={title} description={description}>
      <div className="grid gap-5">
        <div
          className="rounded-2xl border px-4 py-4 text-sm"
          style={{
            borderColor: "color-mix(in oklab, var(--rose) 35%, var(--line))",
            background: "color-mix(in oklab, var(--rose) 8%, white)",
            color: "var(--rose)",
          }}
        >
          {errorDescription || "The email link is invalid or has expired."}
        </div>

        {(errorCode || error) && (
          <div
            className="rounded-2xl border px-4 py-4 text-sm"
            style={{
              borderColor: "var(--line)",
              background: "var(--bg)",
              color: "var(--ink-2)",
            }}
          >
            <p>
              <span className="caps">Error</span>{" "}
              <code>{errorCode || error}</code>
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/login" className="btn btn-primary">
            Back to sign in
          </Link>
          <Link
            href="/forgot-password"
            className="btn"
            style={{ background: "var(--bg)", color: "var(--ink)" }}
          >
            Need a new reset link?
          </Link>
        </div>

        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          If this was an invitation, ask an administrator to resend it.
        </p>
      </div>
    </AuthShell>
  );
}
