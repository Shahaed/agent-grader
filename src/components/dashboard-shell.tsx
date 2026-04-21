"use client";

import Link from "next/link";

import type { AssignmentBundle } from "@/lib/types";
import { formatDate } from "@/lib/utils";

import type { DiagnosticEvent, WorkflowPage } from "./dashboard-shared";

interface DashboardShellProps {
  activePage: WorkflowPage;
  assignments: AssignmentBundle[];
  hasOpenAIKey: boolean;
  title: string;
  description: string;
  status: string;
  error: string;
  currentTask: string | null;
  activity: DiagnosticEvent[];
  children: React.ReactNode;
}

const workflowLinks: Array<{
  href: string;
  id: WorkflowPage;
  label: string;
}> = [
  {
    href: "/assignments",
    id: "assignments",
    label: "Assignment Setup",
  },
  {
    href: "/grading",
    id: "grading",
    label: "Grading Workspace",
  },
];

export function DashboardShell({
  activePage,
  assignments,
  hasOpenAIKey,
  title,
  description,
  status,
  error,
  currentTask,
  activity,
  children,
}: DashboardShellProps) {
  const gradedSubmissionCount = assignments.reduce(
    (count, bundle) => count + bundle.results.length,
    0,
  );
  const promptCount = assignments.reduce(
    (count, bundle) => count + bundle.assignment.assignmentProfile.promptSet.length,
    0,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,210,164,0.22),transparent_30%),linear-gradient(180deg,#fcfaf6_0%,#f6f1e8_45%,#efe7da_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(102,78,48,0.10)] backdrop-blur">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-amber-700">
              AI Writing Grader Prototype
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              {description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {workflowLinks.map((link) => {
                const isActive = link.id === activePage;

                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-950"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="text-sm font-medium text-amber-900">
                  Assignments
                </div>
                <div className="mt-2 text-3xl font-semibold">
                  {assignments.length}
                </div>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4">
                <div className="text-sm font-medium text-teal-900">
                  Graded submissions
                </div>
                <div className="mt-2 text-3xl font-semibold">
                  {gradedSubmissionCount}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-medium text-slate-900">
                  Prompts tracked
                </div>
                <div className="mt-2 text-3xl font-semibold">{promptCount}</div>
              </div>
            </div>
          </div>

          <div className="rounded-4xl border border-white/70 bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(28,21,12,0.18)]">
            <p className="text-sm uppercase tracking-[0.25em] text-amber-200">
              Isolation rules
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Enforced in the app flow
            </h2>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
              <li>Each submission file is segmented against the saved prompt set.</li>
              <li>Each prompt response is graded in its own response call.</li>
              <li>No student writing is reused across submissions.</li>
              <li>
                File search is filtered to assignment-level prompt, anchor, and
                reading assets only.
              </li>
              <li>
                Rubric criteria can be global or prompt-specific and remain
                teacher-editable before grading starts.
              </li>
            </ul>
            {!hasOpenAIKey ? (
              <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                Set <code className="font-mono">OPENAI_API_KEY</code> before
                creating an assignment. The prototype uses the Responses API,
                structured outputs, and vector-store-backed file search.
              </div>
            ) : null}
            {status ? (
              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <div className="font-medium">Status</div>
                <div className="mt-1">{status}</div>
                {currentTask ? (
                  <div className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-200">
                    Active task: {currentTask}
                  </div>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                <div className="font-medium">Latest error</div>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-6 text-rose-100">
                  {error}
                </pre>
              </div>
            ) : null}
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-white">
                Recent activity
              </div>
              <div className="mt-3 space-y-3">
                {activity.length ? (
                  activity.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-white/10 bg-black/10 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-2 py-1 ${
                            entry.kind === "error"
                              ? "bg-rose-500/20 text-rose-100"
                              : entry.kind === "success"
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-slate-500/20 text-slate-100"
                          }`}
                        >
                          {entry.kind}
                        </span>
                        <span className="text-slate-300">
                          {formatDate(entry.at)}
                        </span>
                      </div>
                      <div className="mt-2 font-medium text-white">
                        {entry.label}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-slate-300">
                        {entry.detail}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-300">
                    No requests yet. Each action will log start, success, or
                    failure here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {children}
      </div>
    </div>
  );
}
