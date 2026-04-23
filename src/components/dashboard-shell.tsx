"use client";

import type { AssignmentBundle } from "@/lib/types";
import type { DiagnosticEvent, WorkflowPage } from "./dashboard-shared";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface DashboardShellProps {
  activePage: WorkflowPage;
  assignments: AssignmentBundle[];
  userEmail: string;
  hasOpenAIKey: boolean;
  title: string;
  description: string;
  status: string;
  error: string;
  currentTask: string | null;
  activity: DiagnosticEvent[];
  children: React.ReactNode;
  selectedAssignmentId: string;
  onSelectAssignment?: (id: string) => void;
  onNewAssignment?: () => void;
  breadcrumbs?: Array<{ label: string; muted?: boolean; onClick?: () => void }>;
  tabs?: Array<{ label: string; count?: number; active?: boolean; onClick?: () => void }>;
  topbarActions?: React.ReactNode;
}

export function DashboardShell({
  activePage,
  assignments,
  userEmail,
  status,
  error,
  currentTask,
  children,
  selectedAssignmentId,
  onSelectAssignment,
  onNewAssignment,
  breadcrumbs,
  tabs,
  topbarActions,
}: DashboardShellProps) {
  const defaultBreadcrumbs = breadcrumbs || [
    { label: activePage === "assignments" ? "Assignments" : "Grading", muted: true },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        assignments={assignments}
        selectedAssignmentId={selectedAssignmentId}
        userEmail={userEmail}
        onSelectAssignment={onSelectAssignment}
        onNewAssignment={onNewAssignment}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          breadcrumbs={defaultBreadcrumbs}
          tabs={tabs}
          actions={topbarActions}
        />
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
          <div className="mx-auto max-w-[1200px] px-9 py-8 pb-20">
            {children}
          </div>

          {/* Status bar */}
          {(status || error || currentTask) && (
            <div
              className="fixed bottom-0 right-0 left-[260px] border-t px-9 py-2 text-[12px]"
              style={{
                borderColor: "var(--line)",
                background: "color-mix(in oklab, var(--bg) 95%, transparent)",
                backdropFilter: "blur(6px)",
              }}
            >
              <div className="flex items-center gap-3">
                {currentTask && (
                  <span className="mono" style={{ color: "var(--accent)" }}>
                    {currentTask}
                  </span>
                )}
                {status && !currentTask && (
                  <span style={{ color: "var(--ink-2)" }}>{status}</span>
                )}
                {error && (
                  <span style={{ color: "var(--rose)" }}>{error}</span>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
