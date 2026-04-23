import Link from "next/link";

import { siteConfig } from "@/app/brand";

interface AuthShellProps {
  title: string;
  description: string;
  message?: string;
  error?: string;
  children: React.ReactNode;
}

export function AuthShell({
  title,
  description,
  message,
  error,
  children,
}: AuthShellProps) {
  return (
    <main
      className="min-h-screen px-6 py-12"
      style={{
        background:
          "radial-gradient(circle at top, color-mix(in oklab, var(--accent) 14%, var(--bg)) 0%, var(--bg) 48%)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center">
        <div className="grid w-full max-w-4xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <section
            className="flex flex-col justify-between rounded-[28px] border px-8 py-9 shadow-[0_24px_80px_rgba(15,23,42,0.07)]"
            style={{
              borderColor: "var(--line)",
              background: "var(--paper)",
            }}
          >
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-3 no-underline"
                style={{ color: "var(--ink)" }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "var(--ink)" }}
                >
                  <span
                    className="serif text-xl italic"
                    style={{ color: "var(--bg)" }}
                  >
                    a
                  </span>
                </div>
                <div>
                  <div className="caps" style={{ color: "var(--accent)" }}>
                    {siteConfig.name}
                  </div>
                  <div className="serif text-3xl tracking-tight">{title}</div>
                </div>
              </Link>

              <p
                className="mt-6 max-w-xl text-[15px] leading-7"
                style={{ color: "var(--ink-2)" }}
              >
                {description}
              </p>
            </div>

            <div className="mt-10 grid gap-4 text-[14px]" style={{ color: "var(--ink-2)" }}>
              <div
                className="rounded-2xl border px-4 py-4"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg)",
                }}
              >
                Authentication now runs through Supabase sessions. Assignment data and uploaded
                files stay private to the signed-in teacher.
              </div>
              <div
                className="rounded-2xl border px-4 py-4"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg)",
                }}
              >
                Your rubric, source materials, and graded submissions are stored in Postgres and
                private Storage instead of local files.
              </div>
            </div>
          </section>

          <section
            className="rounded-[28px] border px-7 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.07)]"
            style={{
              borderColor: "var(--line)",
              background: "white",
            }}
          >
            {(message || error) && (
              <div className="mb-5 grid gap-3">
                {message && (
                  <div
                    className="rounded-2xl border px-4 py-3 text-sm"
                    style={{
                      borderColor: "color-mix(in oklab, var(--accent) 35%, var(--line))",
                      background: "color-mix(in oklab, var(--accent) 8%, white)",
                      color: "var(--ink)",
                    }}
                  >
                    {message}
                  </div>
                )}
                {error && (
                  <div
                    className="rounded-2xl border px-4 py-3 text-sm"
                    style={{
                      borderColor: "color-mix(in oklab, var(--rose) 35%, var(--line))",
                      background: "color-mix(in oklab, var(--rose) 8%, white)",
                      color: "var(--rose)",
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            )}

            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
