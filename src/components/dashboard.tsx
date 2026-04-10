"use client";

import { useEffect, useState, useTransition } from "react";

import type {
  AssignmentBundle,
  GradingFeedback,
  GradingResultRecord,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface DashboardProps {
  hasOpenAIKey: boolean;
  initialAssignments: AssignmentBundle[];
}

interface DiagnosticEvent {
  id: string;
  kind: "info" | "success" | "error";
  label: string;
  detail: string;
  at: string;
}

interface AssignmentFormDraft {
  courseName: string;
  subject: string;
  level: string;
  assignmentType: string;
  teacherPreferences: string;
  essayPrompt: string;
  citationExpectations: string;
}

const emptyAssignmentForm: AssignmentFormDraft = {
  courseName: "",
  subject: "",
  level: "high_school",
  assignmentType: "",
  teacherPreferences: "",
  essayPrompt: "",
  citationExpectations: "",
};

const assignmentDraftStorageKey = "agent-grader.assignment-form";
const rubricDraftStorageKey = "agent-grader.rubric-draft";
const selectedAssignmentStorageKey = "agent-grader.selected-assignment";

function readSessionStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(key);
}

async function readJson<T>(response: Response) {
  const rawText = await response.text();
  let payload: (T & { error?: string }) | undefined;

  try {
    payload = rawText ? ((JSON.parse(rawText) as T & { error?: string })) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const detail =
      payload?.error ||
      rawText ||
      `HTTP ${response.status} ${response.statusText || "Request failed"}`;
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${detail}`);
  }

  return (payload || {}) as T;
}

function scoreLabel(result: GradingResultRecord) {
  return `${result.overallScore}/${result.scaleMax}`;
}

function downloadResults(bundle: AssignmentBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${bundle.assignment.id}-results.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Dashboard({ hasOpenAIKey, initialAssignments }: DashboardProps) {
  function rubricFor(assignmentId: string, bundles: AssignmentBundle[]) {
    const bundle = bundles.find((entry) => entry.assignment.id === assignmentId);
    return bundle
      ? JSON.stringify(bundle.assignment.normalizedRubric, null, 2)
      : "";
  }

  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(() => {
    const storedValue = readSessionStorage(selectedAssignmentStorageKey);
    return (
      storedValue &&
      initialAssignments.some((bundle) => bundle.assignment.id === storedValue)
        ? storedValue
        : initialAssignments[0]?.assignment.id ?? ""
    );
  });
  const [rubricDraft, setRubricDraft] = useState(() => {
    const storedValue = readSessionStorage(rubricDraftStorageKey);
    return (
      storedValue ||
      rubricFor(initialAssignments[0]?.assignment.id ?? "", initialAssignments)
    );
  });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormDraft>(() => {
    const storedValue = readSessionStorage(assignmentDraftStorageKey);
    return storedValue
      ? (JSON.parse(storedValue) as AssignmentFormDraft)
      : emptyAssignmentForm;
  });
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [activity, setActivity] = useState<DiagnosticEvent[]>([]);
  const [isPending, startTransition] = useTransition();

  const selectedBundle = assignments.find(
    (bundle) => bundle.assignment.id === selectedAssignmentId,
  );

  useEffect(() => {
    window.sessionStorage.setItem(
      assignmentDraftStorageKey,
      JSON.stringify(assignmentForm),
    );
  }, [assignmentForm]);

  useEffect(() => {
    window.sessionStorage.setItem(rubricDraftStorageKey, rubricDraft);
  }, [rubricDraft]);

  useEffect(() => {
    window.sessionStorage.setItem(
      selectedAssignmentStorageKey,
      selectedAssignmentId,
    );
  }, [selectedAssignmentId]);

  async function refreshAssignments(nextSelectedId?: string) {
    const response = await fetch("/api/assignments", {
      cache: "no-store",
    });
    const payload = await readJson<{ assignments: AssignmentBundle[] }>(response);
    setAssignments(payload.assignments);

    const preferredId =
      nextSelectedId ||
      selectedAssignmentId ||
      payload.assignments[0]?.assignment.id ||
      "";
    setSelectedAssignmentId(preferredId);
    setRubricDraft(rubricFor(preferredId, payload.assignments));
  }

  function pushActivity(kind: DiagnosticEvent["kind"], label: string, detail: string) {
    setActivity((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        kind,
        label,
        detail,
        at: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 8));
  }

  function runTask(label: string, task: () => Promise<void>) {
    setError("");
    setCurrentTask(label);
    setStatus(label);
    pushActivity("info", label, "Started");
    startTransition(async () => {
      try {
        await task();
        pushActivity("success", label, "Completed");
      } catch (taskError) {
        const detail =
          taskError instanceof Error ? taskError.message : "Something went wrong.";
        setError(detail);
        setStatus(`${label} failed.`);
        pushActivity("error", label, detail);
      } finally {
        setCurrentTask(null);
      }
    });
  }

  function handleCreateAssignment(formData: FormData) {
    runTask("Creating assignment and indexing shared context...", async () => {
      const response = await fetch("/api/assignments", {
        method: "POST",
        body: formData,
      });
      const payload = await readJson<{ assignmentId: string }>(response);
      await refreshAssignments(payload.assignmentId);
      setAssignmentForm(emptyAssignmentForm);
      window.sessionStorage.removeItem(assignmentDraftStorageKey);
      setStatus("Assignment created.");
    });
  }

  function handleSaveRubric() {
    if (!selectedBundle) {
      return;
    }

    runTask("Saving normalized rubric...", async () => {
      const response = await fetch(
        `/api/assignments/${selectedBundle.assignment.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rubricJson: rubricDraft,
          }),
        },
      );
      await readJson(response);
      await refreshAssignments(selectedBundle.assignment.id);
      setStatus("Rubric updated.");
    });
  }

  function handleBatchGrade(formData: FormData) {
    if (!selectedBundle) {
      return;
    }

    runTask("Grading submissions independently...", async () => {
      const response = await fetch(
        `/api/assignments/${selectedBundle.assignment.id}/submissions`,
        {
          method: "POST",
          body: formData,
        },
      );
      await readJson(response);
      await refreshAssignments(selectedBundle.assignment.id);
      setStatus("Batch grading completed.");
    });
  }

  function handleCalibration() {
    if (!selectedBundle) {
      return;
    }

    runTask("Running calibration pass...", async () => {
      const response = await fetch(
        `/api/assignments/${selectedBundle.assignment.id}/calibrate`,
        {
          method: "POST",
        },
      );
      await readJson(response);
      await refreshAssignments(selectedBundle.assignment.id);
      setStatus("Calibration summary updated.");
    });
  }

  function updateFeedbackDraft(
    submissionId: string,
    updater: (feedback: GradingFeedback) => GradingFeedback,
  ) {
    setAssignments((current) =>
      current.map((bundle) => {
        if (bundle.assignment.id !== selectedAssignmentId) {
          return bundle;
        }

        return {
          ...bundle,
          results: bundle.results.map((result) =>
            result.submissionId === submissionId
              ? {
                  ...result,
                  feedback: updater(result.feedback),
                }
              : result,
          ),
        };
      }),
    );
  }

  function handleSaveFeedback(result: GradingResultRecord) {
    if (!selectedBundle) {
      return;
    }

    runTask(`Saving feedback for ${result.submissionName}...`, async () => {
      const response = await fetch(
        `/api/assignments/${selectedBundle.assignment.id}/results/${result.submissionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            feedback: result.feedback,
          }),
        },
      );
      await readJson(response);
      await refreshAssignments(selectedBundle.assignment.id);
      setStatus("Feedback saved.");
    });
  }

  function buttonLabel(defaultLabel: string, activeLabel: string) {
    return currentTask === activeLabel || isPending ? "Working..." : defaultLabel;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,210,164,0.22),_transparent_30%),linear-gradient(180deg,_#fcfaf6_0%,_#f6f1e8_45%,_#efe7da_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(102,78,48,0.10)] backdrop-blur">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-amber-700">
              AI Essay Grader Prototype
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Persistent assignment context with isolated grading runs.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Build once at the assignment layer, then grade each essay in its own
              Responses API run. Shared prompt, rubric, and readings stay reusable. No
              cross-student essay context is carried into the primary grading call.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="text-sm font-medium text-amber-900">Assignments</div>
                <div className="mt-2 text-3xl font-semibold">
                  {assignments.length}
                </div>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4">
                <div className="text-sm font-medium text-teal-900">Graded essays</div>
                <div className="mt-2 text-3xl font-semibold">
                  {assignments.reduce((count, bundle) => count + bundle.results.length, 0)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-medium text-slate-900">OpenAI key</div>
                <div className="mt-2 text-lg font-semibold">
                  {hasOpenAIKey ? "Configured" : "Missing"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(28,21,12,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-amber-200">
                  Isolation rules
                </p>
                <h2 className="mt-3 text-2xl font-semibold">Enforced in the app flow</h2>
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
              <li>Each essay is graded in its own response call.</li>
              <li>No shared student essay context is reused between submissions.</li>
              <li>File search is filtered to assignment-level prompt, anchor, and reading assets only.</li>
              <li>Rubric JSON is teacher-editable before grading starts.</li>
              <li>Calibration is a later batch pass over structured results, not the initial grade.</li>
            </ul>
            {!hasOpenAIKey ? (
              <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                Set <code className="font-mono">OPENAI_API_KEY</code> before creating an
                assignment. The prototype uses the Responses API, structured outputs,
                and vector-store-backed file search.
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
              <div className="text-sm font-medium text-white">Recent activity</div>
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
                        <span className="text-slate-300">{formatDate(entry.at)}</span>
                      </div>
                      <div className="mt-2 font-medium text-white">{entry.label}</div>
                      <div className="mt-1 whitespace-pre-wrap text-slate-300">
                        {entry.detail}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-300">
                    No requests yet. Each action will log start, success, or failure
                    here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">1. Create Assignment</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload the rubric once, capture shared context, and index readings for
                retrieval-aware grading.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                If this fails, the exact backend error will appear in the diagnostics
                panel on the right.
              </p>
            </div>
            <form
              action={handleCreateAssignment}
              className="grid gap-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Course name
                  <input
                    required
                    name="courseName"
                    value={assignmentForm.courseName}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        courseName: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                    placeholder="AP Literature"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Subject
                  <input
                    required
                    name="subject"
                    value={assignmentForm.subject}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                    placeholder="English"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Class level
                  <select
                    name="level"
                    value={assignmentForm.level}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        level: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  >
                    <option value="high_school">High school</option>
                    <option value="college">College</option>
                    <option value="ap">AP</option>
                    <option value="esl">ESL</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Assignment type
                  <input
                    required
                    name="assignmentType"
                    value={assignmentForm.assignmentType}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        assignmentType: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                    placeholder="Source-based analysis"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Teacher preferences
                <textarea
                  name="teacherPreferences"
                  rows={3}
                  value={assignmentForm.teacherPreferences}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      teacherPreferences: event.target.value,
                    }))
                  }
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="Firm on source fidelity, concise student feedback, flag unclear citations."
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Essay prompt
                <textarea
                  required
                  name="essayPrompt"
                  rows={6}
                  value={assignmentForm.essayPrompt}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      essayPrompt: event.target.value,
                    }))
                  }
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="Analyze how the author develops..."
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Citation expectations
                <textarea
                  name="citationExpectations"
                  rows={3}
                  value={assignmentForm.citationExpectations}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      citationExpectations: event.target.value,
                    }))
                  }
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="At least two direct quotations with MLA parenthetical citations."
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Rubric file
                <input
                  required
                  name="rubricFile"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.json"
                  className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Readings and source materials
                <input
                  multiple
                  name="readingFiles"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.json"
                  className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                />
              </label>
              <button
                disabled={isPending || !hasOpenAIKey}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buttonLabel(
                  "Create assignment",
                  "Creating assignment and indexing shared context...",
                )}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">2. Review Assignment Context</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Select an assignment, inspect the normalized rubric, and adjust it
                    before any grading run starts.
                  </p>
                </div>
                <select
                  value={selectedAssignmentId}
                  onChange={(event) => {
                    setSelectedAssignmentId(event.target.value);
                    setRubricDraft(rubricFor(event.target.value, assignments));
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-amber-400"
                >
                  {assignments.length === 0 ? (
                    <option value="">No assignments yet</option>
                  ) : null}
                  {assignments.map((bundle) => (
                    <option key={bundle.assignment.id} value={bundle.assignment.id}>
                      {bundle.assignment.courseProfile.courseName} · {bundle.assignment.id}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBundle ? (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Level profile
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {selectedBundle.assignment.levelProfile}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Shared assets
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {selectedBundle.assignment.assets.length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Total rubric scale
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {selectedBundle.assignment.normalizedRubric.totalScaleMax}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <div className="text-sm font-medium text-slate-900">Context summary</div>
                    <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-6 text-slate-600">
                      {selectedBundle.assignment.contextSummary}
                    </pre>
                  </div>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Editable normalized rubric JSON
                    <textarea
                      rows={18}
                      value={rubricDraft}
                      onChange={(event) => setRubricDraft(event.target.value)}
                      className="rounded-[1.75rem] border border-slate-200 bg-slate-950 px-5 py-4 font-mono text-xs leading-6 text-slate-100 outline-none transition focus:border-amber-400"
                    />
                  </label>
                  <button
                    onClick={handleSaveRubric}
                    disabled={isPending}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {buttonLabel("Save rubric JSON", "Saving normalized rubric...")}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
                  Create an assignment first to review its context package.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">3. Batch Grading</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Upload multiple student essays. The server processes them one by one
                    through separate grading runs using the same stored assignment
                    context.
                  </p>
                </div>
                {selectedBundle ? (
                  <button
                    onClick={() => downloadResults(selectedBundle)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
                  >
                    Export JSON
                  </button>
                ) : null}
              </div>

              <form action={handleBatchGrade} className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Student submissions
                  <input
                    multiple
                    required
                    name="submissionFiles"
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    disabled={!selectedBundle}
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
                <button
                  disabled={isPending || !selectedBundle}
                  className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {buttonLabel(
                    "Grade uploaded batch",
                    "Grading submissions independently...",
                  )}
                </button>
              </form>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleCalibration}
                  disabled={isPending || !selectedBundle || selectedBundle.results.length < 2}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {buttonLabel(
                    "Run optional calibration pass",
                    "Running calibration pass...",
                  )}
                </button>
              </div>

              {selectedBundle?.calibration ? (
                <div className="mt-6 rounded-[1.75rem] border border-teal-200 bg-teal-50/80 p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-base font-semibold text-teal-950">
                      Latest calibration summary
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-teal-700">
                      {formatDate(selectedBundle.calibration.createdAt)}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-teal-950">
                    {selectedBundle.calibration.batchSummary}
                  </p>
                  {selectedBundle.calibration.patterns.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedBundle.calibration.patterns.map((pattern) => (
                        <span
                          key={pattern}
                          className="rounded-full border border-teal-300 bg-white/80 px-3 py-1 text-xs text-teal-900"
                        >
                          {pattern}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">4. Review Results</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Scores, rationale, evidence references, flags, retrieval sources, and
                editable feedback are all stored per submission.
              </p>
            </div>
            {selectedBundle ? (
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                {selectedBundle.results.length} graded submissions
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-5">
            {selectedBundle?.results.length ? (
              selectedBundle.results.map((result) => (
                <article
                  key={result.submissionId}
                  className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                        {formatDate(result.createdAt)}
                      </div>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {result.submissionName}
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-medium text-white">
                          {scoreLabel(result)}
                        </span>
                        <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700">
                          Confidence {Math.round(result.confidence * 100)}%
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-sm ${
                            result.review.needsHumanReview
                              ? "bg-rose-100 text-rose-900"
                              : "bg-emerald-100 text-emerald-900"
                          }`}
                        >
                          {result.review.needsHumanReview
                            ? "Needs human review"
                            : "Ready to review"}
                        </span>
                      </div>
                    </div>

                    <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                      <div className="font-medium text-slate-900">Teacher summary</div>
                      <p className="mt-2">{result.feedback.teacherSummary}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {result.dimensions.map((dimension) => (
                      <div
                        key={`${result.submissionId}-${dimension.name}`}
                        className="rounded-3xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base font-semibold text-slate-950">
                            {dimension.name}
                          </div>
                          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                            {dimension.score}/{dimension.scaleMax}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {dimension.rationale}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                            Confidence {Math.round(dimension.confidence * 100)}%
                          </span>
                          {dimension.flags.map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                        {dimension.evidenceSpans.length ? (
                          <div className="mt-4 space-y-2">
                            {dimension.evidenceSpans.map((spanId) => (
                              <div
                                key={spanId}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
                              >
                                <span className="font-medium text-slate-900">{spanId}</span>{" "}
                                {result.evidenceLookup[spanId] || "Span excerpt unavailable."}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-medium text-slate-900">Review reasons</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.review.reasons.length ? (
                          result.review.reasons.map((reason) => (
                            <span
                              key={reason}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-900"
                            >
                              {reason}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No review flags.</span>
                        )}
                      </div>

                      <div className="mt-5 text-sm font-medium text-slate-900">
                        Retrieved sources
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.retrievalSources.length ? (
                          result.retrievalSources.map((source) => (
                            <span
                              key={source}
                              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs text-teal-900"
                            >
                              {source}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">
                            No file-search sources were surfaced in the response.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-4">
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Teacher-facing summary
                          <textarea
                            rows={4}
                            value={result.feedback.teacherSummary}
                            onChange={(event) =>
                              updateFeedbackDraft(result.submissionId, (feedback) => ({
                                ...feedback,
                                teacherSummary: event.target.value,
                              }))
                            }
                            className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-400"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Student feedback points
                          <textarea
                            rows={5}
                            value={result.feedback.studentFeedback.join("\n")}
                            onChange={(event) =>
                              updateFeedbackDraft(result.submissionId, (feedback) => ({
                                ...feedback,
                                studentFeedback: event.target.value
                                  .split("\n")
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              }))
                            }
                            className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-400"
                          />
                        </label>
                        <button
                          onClick={() => handleSaveFeedback(result)}
                          disabled={isPending}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {buttonLabel(
                            "Save feedback edits",
                            `Saving feedback for ${result.submissionName}...`,
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">
                Select an assignment and run a batch to populate the review dashboard.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
