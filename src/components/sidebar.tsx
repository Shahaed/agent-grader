"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AssignmentBundle } from "@/lib/types";
import type { WorkflowPage } from "./dashboard-shared";

interface SidebarProps {
  assignments: AssignmentBundle[];
  selectedAssignmentId: string;
  userEmail: string;
  onSelectAssignment?: (id: string) => void;
  onNewAssignment?: () => void;
}

const navItems: Array<{ href: string; id: WorkflowPage; label: string }> = [
  { href: "/assignments", id: "assignments", label: "Assignments" },
  { href: "/grading", id: "grading", label: "Grading" },
];

export function Sidebar({
  assignments,
  selectedAssignmentId,
  userEmail,
  onSelectAssignment,
  onNewAssignment,
}: SidebarProps) {
  const pathname = usePathname();
  const activePage = pathname.startsWith("/grading") ? "grading" : "assignments";

  return (
    <aside
      className="flex h-full w-[260px] flex-col border-r border-line"
      style={{ background: "var(--bg-sunk)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px]"
          style={{ background: "var(--ink)" }}
        >
          <span
            className="serif text-[15px] italic leading-none"
            style={{ color: "var(--bg)" }}
          >
            a
          </span>
        </div>
        <span className="serif text-[19px] tracking-tight" style={{ color: "var(--ink)" }}>
          Agent <em className="italic" style={{ color: "var(--accent)" }}>Grader</em>
        </span>
      </div>

      {/* Nav */}
      <nav className="mt-2 flex flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          const count =
            item.id === "assignments"
              ? assignments.length
              : assignments.reduce((n, b) => n + b.results.length, 0);

          return (
            <Link
              key={item.id}
              href={item.href}
              className="btn flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors"
              style={{
                background: isActive ? "var(--ink)" : "transparent",
                color: isActive ? "var(--bg)" : "var(--ink-2)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--paper)";
                  e.currentTarget.style.color = "var(--ink)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--ink-2)";
                }
              }}
            >
              {item.label}
              <span
                className="mono rounded-full px-1.5 py-px text-[10px]"
                style={{
                  background: isActive ? "oklch(0.3 0.02 70)" : "var(--bg-sunk)",
                  color: isActive ? "var(--bg)" : "var(--ink-3)",
                  border: isActive ? "none" : "1px solid var(--line-soft)",
                }}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 mt-4 mb-2 flex items-center justify-between">
        <span className="caps" style={{ color: "var(--ink-3)" }}>
          Assignments
        </span>
        {onNewAssignment && (
          <button
            type="button"
            onClick={onNewAssignment}
            className="btn flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-xs transition-colors"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--ink)";
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Assignment list */}
      <div className="flex-1 overflow-y-auto px-3">
        {assignments.length === 0 ? (
          <div className="px-2.5 py-4 text-[12px]" style={{ color: "var(--ink-3)" }}>
            No assignments yet.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {assignments.map((bundle) => {
              const isSelected = bundle.assignment.id === selectedAssignmentId;
              return (
                <button
                  key={bundle.assignment.id}
                  type="button"
                  onClick={() => onSelectAssignment?.(bundle.assignment.id)}
                  className="btn w-full rounded-lg p-2.5 text-left transition-colors"
                  style={{
                    background: isSelected ? "var(--paper)" : "transparent",
                    border: isSelected ? "1px solid var(--line)" : "1px solid transparent",
                  }}
                >
                  <div
                    className="truncate text-[13px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {bundle.assignment.assignmentName}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {bundle.assignment.courseProfile.courseName} &middot;{" "}
                    {bundle.assignment.assignmentProfile.promptSet.length} prompts
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="mt-auto border-t px-3 py-3"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="rounded-xl border border-line bg-paper px-3 py-3">
          <div className="caps" style={{ color: "var(--ink-3)" }}>
            Signed in
          </div>
          <div className="mt-1 truncate text-[13px]" style={{ color: "var(--ink)" }}>
            {userEmail}
          </div>
          <form action="/auth/signout" method="post" className="mt-3">
            <button type="submit" className="btn btn-secondary btn-sm w-full">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
