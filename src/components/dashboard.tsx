"use client";

import { useEffect, useState, useTransition } from "react";

import type {
  AssignmentBundle,
  GradingFeedback,
  GradingResultRecord,
  NormalizedRubric,
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

interface RubricBandDraft {
  label: string;
  min: string;
  max: string;
  descriptor: string;
}

interface RubricDimensionDraft {
  name: string;
  weight: string;
  scaleMax: string;
  descriptor: string;
  bands: RubricBandDraft[];
}

interface RubricFormDraft {
  rubricId: string;
  gradingMode: "analytic" | "holistic";
  totalScaleMax: string;
  hardRequirements: string[];
  notes: string;
  dimensions: RubricDimensionDraft[];
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
    payload = rawText
      ? (JSON.parse(rawText) as T & { error?: string })
      : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const detail =
      payload?.error ||
      rawText ||
      `HTTP ${response.status} ${response.statusText || "Request failed"}`;
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${detail}`,
    );
  }

  return (payload || {}) as T;
}

function scoreLabel(result: GradingResultRecord) {
  return `${result.overallScore}/${result.scaleMax}`;
}

function emptyBandDraft(): RubricBandDraft {
  return {
    label: "",
    min: "0",
    max: "0",
    descriptor: "",
  };
}

function emptyDimensionDraft(): RubricDimensionDraft {
  return {
    name: "",
    weight: "0",
    scaleMax: "4",
    descriptor: "",
    bands: [emptyBandDraft()],
  };
}

function rubricFormFromNormalizedRubric(
  rubric: NormalizedRubric,
): RubricFormDraft {
  return {
    rubricId: rubric.rubricId,
    gradingMode: rubric.gradingMode,
    totalScaleMax: String(rubric.totalScaleMax),
    hardRequirements:
      rubric.hardRequirements.length > 0 ? rubric.hardRequirements : [""],
    notes: rubric.notes ?? "",
    dimensions: rubric.dimensions.map((dimension) => ({
      name: dimension.name,
      weight: String(dimension.weight),
      scaleMax: String(dimension.scaleMax),
      descriptor: dimension.descriptor ?? "",
      bands: dimension.bands.map((band) => ({
        label: band.label,
        min: String(band.scoreRange.min),
        max: String(band.scoreRange.max),
        descriptor: band.descriptor,
      })),
    })),
  };
}

function parseNumberField(
  value: string,
  label: string,
  {
    min,
    max,
    allowZero = false,
  }: { min?: number; max?: number; allowZero?: boolean } = {},
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  if (!allowZero && parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }

  if (allowZero && parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  if (min !== undefined && parsed < min) {
    throw new Error(`${label} must be at least ${min}.`);
  }

  if (max !== undefined && parsed > max) {
    throw new Error(`${label} must be no more than ${max}.`);
  }

  return parsed;
}

function normalizedRubricFromFormDraft(
  draft: RubricFormDraft,
): NormalizedRubric {
  const dimensions = draft.dimensions.map((dimension, dimensionIndex) => {
    if (!dimension.name.trim()) {
      throw new Error(`Criterion ${dimensionIndex + 1} needs a name.`);
    }

    if (dimension.bands.length === 0) {
      throw new Error(`Criterion ${dimensionIndex + 1} needs at least one performance band.`);
    }

    return {
      name: dimension.name.trim(),
      weight: parseNumberField(
        dimension.weight,
        `Weight for ${dimension.name || `criterion ${dimensionIndex + 1}`}`,
        {
          min: 0,
          max: 1,
          allowZero: true,
        },
      ),
      scaleMax: parseNumberField(
        dimension.scaleMax,
        `Maximum score for ${dimension.name || `criterion ${dimensionIndex + 1}`}`,
      ),
      descriptor: dimension.descriptor.trim() || null,
      bands: dimension.bands.map((band, bandIndex) => {
        if (!band.label.trim()) {
          throw new Error(
            `Band ${bandIndex + 1} in ${dimension.name || `criterion ${dimensionIndex + 1}`} needs a label.`,
          );
        }

        if (!band.descriptor.trim()) {
          throw new Error(
            `Band ${band.label || bandIndex + 1} in ${dimension.name || `criterion ${dimensionIndex + 1}`} needs a description.`,
          );
        }

        const rangeStart = parseNumberField(
          band.min,
          `Range start for ${band.label || `band ${bandIndex + 1}`}`,
          {
            min: 0,
            allowZero: true,
          },
        );
        const rangeEnd = parseNumberField(
          band.max,
          `Range end for ${band.label || `band ${bandIndex + 1}`}`,
          {
            min: 0,
            allowZero: true,
          },
        );

        if (rangeEnd < rangeStart) {
          throw new Error(
            `Score range for ${band.label || `band ${bandIndex + 1}`} cannot end before it starts.`,
          );
        }

        return {
          label: band.label.trim(),
          scoreRange: {
            min: rangeStart,
            max: rangeEnd,
          },
          descriptor: band.descriptor.trim(),
        };
      }),
    };
  });

  if (!draft.rubricId.trim()) {
    throw new Error("Rubric ID is required.");
  }

  return {
    rubricId: draft.rubricId.trim(),
    gradingMode: draft.gradingMode,
    totalScaleMax: parseNumberField(draft.totalScaleMax, "Total rubric scale"),
    dimensions,
    hardRequirements: draft.hardRequirements
      .map((requirement) => requirement.trim())
      .filter(Boolean),
    notes: draft.notes.trim() || null,
  };
}

function rubricFormFor(
  assignmentId: string,
  bundles: AssignmentBundle[],
): RubricFormDraft {
  const bundle = bundles.find((entry) => entry.assignment.id === assignmentId);
  return bundle
    ? rubricFormFromNormalizedRubric(bundle.assignment.normalizedRubric)
    : {
        rubricId: "",
        gradingMode: "analytic",
        totalScaleMax: "",
        hardRequirements: [""],
        notes: "",
        dimensions: [emptyDimensionDraft()],
      };
}

function parseStoredRubricDraft(
  storedValue: string | null,
  fallback: RubricFormDraft,
) {
  if (!storedValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "dimensions" in parsed &&
      Array.isArray(parsed.dimensions) &&
      "totalScaleMax" in parsed &&
      typeof (parsed as { totalScaleMax?: unknown }).totalScaleMax === "number"
    ) {
      return rubricFormFromNormalizedRubric(parsed as NormalizedRubric);
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "dimensions" in parsed &&
      Array.isArray(parsed.dimensions)
    ) {
      return parsed as RubricFormDraft;
    }
  } catch {
    // Fall back to the current assignment copy if session storage is stale.
  }

  return fallback;
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

export function Dashboard({
  hasOpenAIKey,
  initialAssignments,
}: DashboardProps) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(() => {
    const storedValue = readSessionStorage(selectedAssignmentStorageKey);
    return storedValue &&
      initialAssignments.some((bundle) => bundle.assignment.id === storedValue)
      ? storedValue
      : (initialAssignments[0]?.assignment.id ?? "");
  });
  const [rubricDraft, setRubricDraft] = useState(() => {
    const storedValue = readSessionStorage(rubricDraftStorageKey);
    return parseStoredRubricDraft(
      storedValue,
      rubricFormFor(initialAssignments[0]?.assignment.id ?? "", initialAssignments),
    );
  });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormDraft>(
    () => {
      const storedValue = readSessionStorage(assignmentDraftStorageKey);
      return storedValue
        ? (JSON.parse(storedValue) as AssignmentFormDraft)
        : emptyAssignmentForm;
    },
  );
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
    window.sessionStorage.setItem(
      rubricDraftStorageKey,
      JSON.stringify(rubricDraft),
    );
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
    const payload = await readJson<{ assignments: AssignmentBundle[] }>(
      response,
    );
    setAssignments(payload.assignments);

    const preferredId =
      nextSelectedId ||
      selectedAssignmentId ||
      payload.assignments[0]?.assignment.id ||
      "";
    setSelectedAssignmentId(preferredId);
    setRubricDraft(rubricFormFor(preferredId, payload.assignments));
  }

  function pushActivity(
    kind: DiagnosticEvent["kind"],
    label: string,
    detail: string,
  ) {
    setActivity((current) =>
      [
        {
          id: `${Date.now()}-${current.length}`,
          kind,
          label,
          detail,
          at: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 8),
    );
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
          taskError instanceof Error
            ? taskError.message
            : "Something went wrong.";
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
      const normalizedRubric = normalizedRubricFromFormDraft(rubricDraft);
      const response = await fetch(
        `/api/assignments/${selectedBundle.assignment.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rubricJson: JSON.stringify(normalizedRubric, null, 2),
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
    return currentTask === activeLabel || isPending
      ? "Working..."
      : defaultLabel;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,210,164,0.22),transparent_30%),linear-gradient(180deg,#fcfaf6_0%,#f6f1e8_45%,#efe7da_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(102,78,48,0.10)] backdrop-blur">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-amber-700">
              AI Essay Grader Prototype
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Persistent assignment context with isolated grading runs.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Build once at the assignment layer, then grade each essay in its
              own Responses API run. Shared prompt, rubric, and readings stay
              reusable. No cross-student essay context is carried into the
              primary grading call.
            </p>
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
                  Graded essays
                </div>
                <div className="mt-2 text-3xl font-semibold">
                  {assignments.reduce(
                    (count, bundle) => count + bundle.results.length,
                    0,
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-medium text-slate-900">
                  OpenAI key
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {hasOpenAIKey ? "Configured" : "Missing"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-4xl border border-white/70 bg-slate-950 p-8 text-slate-50 shadow-[0_24px_80px_rgba(28,21,12,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-amber-200">
                  Isolation rules
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  Enforced in the app flow
                </h2>
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
              <li>Each essay is graded in its own response call.</li>
              <li>
                No shared student essay context is reused between submissions.
              </li>
              <li>
                File search is filtered to assignment-level prompt, anchor, and
                reading assets only.
              </li>
              <li>Rubric criteria and score bands are teacher-editable before grading starts.</li>
              <li>
                Calibration is a later batch pass over structured results, not
                the initial grade.
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

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">1. Create Assignment</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload the rubric once, capture shared context, and index
                readings for retrieval-aware grading.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                If this fails, the exact backend error will appear in the
                diagnostics panel on the right.
              </p>
            </div>
            <form action={handleCreateAssignment} className="grid gap-4">
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
            <div className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">
                    2. Review Assignment Context
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Select an assignment, inspect the normalized rubric, and
                    adjust it before any grading run starts.
                  </p>
                </div>
                <select
                  value={selectedAssignmentId}
                  onChange={(event) => {
                    setSelectedAssignmentId(event.target.value);
                    setRubricDraft(rubricFormFor(event.target.value, assignments));
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-amber-400"
                >
                  {assignments.length === 0 ? (
                    <option value="">No assignments yet</option>
                  ) : null}
                  {assignments.map((bundle) => (
                    <option
                      key={bundle.assignment.id}
                      value={bundle.assignment.id}
                    >
                      {bundle.assignment.courseProfile.courseName} ·{" "}
                      {bundle.assignment.id}
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
                        {
                          selectedBundle.assignment.normalizedRubric
                            .totalScaleMax
                        }
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <div className="text-sm font-medium text-slate-900">
                      Context summary
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-6 text-slate-600">
                      {selectedBundle.assignment.contextSummary}
                    </pre>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                      <h3 className="text-base font-semibold text-slate-900">
                        Rubric setup
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Edit the grading rules in plain language. This form controls
                        the structured rubric the model uses during scoring.
                      </p>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Rubric ID
                          <input
                            value={rubricDraft.rubricId}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                rubricId: event.target.value,
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                          />
                          <span className="text-xs font-normal leading-5 text-slate-500">
                            Internal identifier for this normalized rubric record.
                          </span>
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Grading mode
                          <select
                            value={rubricDraft.gradingMode}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                gradingMode: event.target.value as
                                  | "analytic"
                                  | "holistic",
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                          >
                            <option value="analytic">Analytic</option>
                            <option value="holistic">Holistic</option>
                          </select>
                          <span className="text-xs font-normal leading-5 text-slate-500">
                            Analytic scores each criterion separately. Holistic treats
                            the rubric as a single overall judgment.
                          </span>
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Total rubric scale
                          <input
                            inputMode="decimal"
                            value={rubricDraft.totalScaleMax}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                totalScaleMax: event.target.value,
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                          />
                          <span className="text-xs font-normal leading-5 text-slate-500">
                            Highest total score a submission can earn across the full rubric.
                          </span>
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Notes
                          <textarea
                            rows={4}
                            value={rubricDraft.notes}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                            placeholder="Optional note about how this rubric should be interpreted."
                          />
                          <span className="text-xs font-normal leading-5 text-slate-500">
                            Optional teacher-facing guidance that clarifies how to read the rubric.
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">
                            Hard requirements
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Non-negotiable expectations the writer must satisfy, such as
                            citation rules or required textual evidence.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRubricDraft((current) => ({
                              ...current,
                              hardRequirements: [...current.hardRequirements, ""],
                            }))
                          }
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
                        >
                          Add requirement
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {rubricDraft.hardRequirements.map((requirement, requirementIndex) => (
                          <div
                            key={`requirement-${requirementIndex}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <label className="grid flex-1 gap-2 text-sm font-medium text-slate-700">
                                Requirement {requirementIndex + 1}
                                <textarea
                                  rows={2}
                                  value={requirement}
                                  onChange={(event) =>
                                    setRubricDraft((current) => ({
                                      ...current,
                                      hardRequirements: current.hardRequirements.map(
                                        (entry, entryIndex) =>
                                          entryIndex === requirementIndex
                                            ? event.target.value
                                            : entry,
                                      ),
                                    }))
                                  }
                                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                  placeholder="Example: Include at least two direct quotations."
                                />
                                <span className="text-xs font-normal leading-5 text-slate-500">
                                  Leave blank if this requirement should not be enforced.
                                </span>
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setRubricDraft((current) => ({
                                    ...current,
                                    hardRequirements:
                                      current.hardRequirements.length === 1
                                        ? [""]
                                        : current.hardRequirements.filter(
                                            (_, entryIndex) =>
                                              entryIndex !== requirementIndex,
                                          ),
                                  }))
                                }
                                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">
                            Criteria and score bands
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Each criterion defines one thing the essay is judged on.
                            Each band describes performance at a score range.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRubricDraft((current) => ({
                              ...current,
                              dimensions: [...current.dimensions, emptyDimensionDraft()],
                            }))
                          }
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
                        >
                          Add criterion
                        </button>
                      </div>

                      <div className="mt-5 space-y-5">
                        {rubricDraft.dimensions.map((dimension, dimensionIndex) => (
                          <div
                            key={`dimension-${dimensionIndex}`}
                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  Criterion {dimensionIndex + 1}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  Define the category name, its importance, and the score
                                  levels students can earn.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setRubricDraft((current) => ({
                                    ...current,
                                    dimensions:
                                      current.dimensions.length === 1
                                        ? [emptyDimensionDraft()]
                                        : current.dimensions.filter(
                                            (_, entryIndex) =>
                                              entryIndex !== dimensionIndex,
                                          ),
                                  }))
                                }
                                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
                              >
                                Remove criterion
                              </button>
                            </div>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                              <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
                                Criterion name
                                <input
                                  value={dimension.name}
                                  onChange={(event) =>
                                    setRubricDraft((current) => ({
                                      ...current,
                                      dimensions: current.dimensions.map((entry, entryIndex) =>
                                        entryIndex === dimensionIndex
                                          ? { ...entry, name: event.target.value }
                                          : entry,
                                      ),
                                    }))
                                  }
                                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                  placeholder="Evidence"
                                />
                                <span className="text-xs font-normal leading-5 text-slate-500">
                                  The skill or outcome being scored.
                                </span>
                              </label>
                              <label className="grid gap-2 text-sm font-medium text-slate-700">
                                Weight
                                <input
                                  inputMode="decimal"
                                  value={dimension.weight}
                                  onChange={(event) =>
                                    setRubricDraft((current) => ({
                                      ...current,
                                      dimensions: current.dimensions.map((entry, entryIndex) =>
                                        entryIndex === dimensionIndex
                                          ? { ...entry, weight: event.target.value }
                                          : entry,
                                      ),
                                    }))
                                  }
                                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                  placeholder="0.25"
                                />
                                <span className="text-xs font-normal leading-5 text-slate-500">
                                  Relative importance. Analytic rubrics should total 1 across all criteria.
                                </span>
                              </label>
                              <label className="grid gap-2 text-sm font-medium text-slate-700">
                                Max score
                                <input
                                  inputMode="decimal"
                                  value={dimension.scaleMax}
                                  onChange={(event) =>
                                    setRubricDraft((current) => ({
                                      ...current,
                                      dimensions: current.dimensions.map((entry, entryIndex) =>
                                        entryIndex === dimensionIndex
                                          ? { ...entry, scaleMax: event.target.value }
                                          : entry,
                                      ),
                                    }))
                                  }
                                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                  placeholder="4"
                                />
                                <span className="text-xs font-normal leading-5 text-slate-500">
                                  Highest score possible for this single criterion.
                                </span>
                              </label>
                            </div>

                            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                              Criterion description
                              <textarea
                                rows={3}
                                value={dimension.descriptor}
                                onChange={(event) =>
                                  setRubricDraft((current) => ({
                                    ...current,
                                    dimensions: current.dimensions.map((entry, entryIndex) =>
                                      entryIndex === dimensionIndex
                                        ? { ...entry, descriptor: event.target.value }
                                        : entry,
                                    ),
                                  }))
                                }
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                placeholder="Explain what strong performance looks like in this category."
                              />
                              <span className="text-xs font-normal leading-5 text-slate-500">
                                Short summary of what this criterion measures.
                              </span>
                            </label>

                            <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    Performance bands
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Describe the score ranges and what student work looks
                                    like at each level.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRubricDraft((current) => ({
                                      ...current,
                                      dimensions: current.dimensions.map((entry, entryIndex) =>
                                        entryIndex === dimensionIndex
                                          ? {
                                              ...entry,
                                              bands: [...entry.bands, emptyBandDraft()],
                                            }
                                          : entry,
                                      ),
                                    }))
                                  }
                                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
                                >
                                  Add band
                                </button>
                              </div>

                              <div className="mt-4 space-y-4">
                                {dimension.bands.map((band, bandIndex) => (
                                  <div
                                    key={`band-${dimensionIndex}-${bandIndex}`}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          Band {bandIndex + 1}
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          A label, a score range, and a description of this
                                          level of performance.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRubricDraft((current) => ({
                                            ...current,
                                            dimensions: current.dimensions.map(
                                              (entry, entryIndex) =>
                                                entryIndex === dimensionIndex
                                                  ? {
                                                      ...entry,
                                                      bands:
                                                        entry.bands.length === 1
                                                          ? [emptyBandDraft()]
                                                          : entry.bands.filter(
                                                              (_, innerBandIndex) =>
                                                                innerBandIndex !== bandIndex,
                                                            ),
                                                    }
                                                  : entry,
                                            ),
                                          }))
                                        }
                                        className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
                                      >
                                        Remove band
                                      </button>
                                    </div>

                                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                                        Band label
                                        <input
                                          value={band.label}
                                          onChange={(event) =>
                                            setRubricDraft((current) => ({
                                              ...current,
                                              dimensions: current.dimensions.map(
                                                (entry, entryIndex) =>
                                                  entryIndex === dimensionIndex
                                                    ? {
                                                        ...entry,
                                                        bands: entry.bands.map(
                                                          (bandEntry, innerBandIndex) =>
                                                            innerBandIndex === bandIndex
                                                              ? {
                                                                  ...bandEntry,
                                                                  label: event.target.value,
                                                                }
                                                              : bandEntry,
                                                        ),
                                                      }
                                                    : entry,
                                              ),
                                            }))
                                          }
                                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                          placeholder="Exceeds expectations"
                                        />
                                        <span className="text-xs font-normal leading-5 text-slate-500">
                                          Short name for the performance level.
                                        </span>
                                      </label>
                                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                                        Range start
                                        <input
                                          inputMode="decimal"
                                          value={band.min}
                                          onChange={(event) =>
                                            setRubricDraft((current) => ({
                                              ...current,
                                              dimensions: current.dimensions.map(
                                                (entry, entryIndex) =>
                                                  entryIndex === dimensionIndex
                                                    ? {
                                                        ...entry,
                                                        bands: entry.bands.map(
                                                          (bandEntry, innerBandIndex) =>
                                                            innerBandIndex === bandIndex
                                                              ? {
                                                                  ...bandEntry,
                                                                  min: event.target.value,
                                                                }
                                                              : bandEntry,
                                                        ),
                                                      }
                                                    : entry,
                                              ),
                                            }))
                                          }
                                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                        />
                                        <span className="text-xs font-normal leading-5 text-slate-500">
                                          Lowest score included in this band.
                                        </span>
                                      </label>
                                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                                        Range end
                                        <input
                                          inputMode="decimal"
                                          value={band.max}
                                          onChange={(event) =>
                                            setRubricDraft((current) => ({
                                              ...current,
                                              dimensions: current.dimensions.map(
                                                (entry, entryIndex) =>
                                                  entryIndex === dimensionIndex
                                                    ? {
                                                        ...entry,
                                                        bands: entry.bands.map(
                                                          (bandEntry, innerBandIndex) =>
                                                            innerBandIndex === bandIndex
                                                              ? {
                                                                  ...bandEntry,
                                                                  max: event.target.value,
                                                                }
                                                              : bandEntry,
                                                        ),
                                                      }
                                                    : entry,
                                              ),
                                            }))
                                          }
                                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                        />
                                        <span className="text-xs font-normal leading-5 text-slate-500">
                                          Highest score included in this band.
                                        </span>
                                      </label>
                                    </div>

                                    <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                                      Band description
                                      <textarea
                                        rows={3}
                                        value={band.descriptor}
                                        onChange={(event) =>
                                          setRubricDraft((current) => ({
                                            ...current,
                                            dimensions: current.dimensions.map(
                                              (entry, entryIndex) =>
                                                entryIndex === dimensionIndex
                                                  ? {
                                                      ...entry,
                                                      bands: entry.bands.map(
                                                        (bandEntry, innerBandIndex) =>
                                                          innerBandIndex === bandIndex
                                                            ? {
                                                                ...bandEntry,
                                                                descriptor: event.target.value,
                                                              }
                                                            : bandEntry,
                                                      ),
                                                    }
                                                  : entry,
                                            ),
                                          }))
                                        }
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                                        placeholder="Describe what student work looks like in this score range."
                                      />
                                      <span className="text-xs font-normal leading-5 text-slate-500">
                                        Concrete description of the writing quality or evidence expected at this level.
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveRubric}
                    disabled={isPending}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {buttonLabel(
                      "Save rubric changes",
                      "Saving normalized rubric...",
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
                  Create an assignment first to review its context package.
                </div>
              )}
            </div>

            <div className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">3. Batch Grading</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Upload multiple student essays. The server processes them
                    one by one through separate grading runs using the same
                    stored assignment context.
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
                  disabled={
                    isPending ||
                    !selectedBundle ||
                    selectedBundle.results.length < 2
                  }
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

        <section className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">4. Review Results</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Scores, rationale, evidence references, flags, retrieval
                sources, and editable feedback are all stored per submission.
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
                      <div className="font-medium text-slate-900">
                        Teacher summary
                      </div>
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
                                <span className="font-medium text-slate-900">
                                  {spanId}
                                </span>{" "}
                                {result.evidenceLookup[spanId] ||
                                  "Span excerpt unavailable."}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-medium text-slate-900">
                        Review reasons
                      </div>
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
                          <span className="text-sm text-slate-500">
                            No review flags.
                          </span>
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
                            No file-search sources were surfaced in the
                            response.
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
                              updateFeedbackDraft(
                                result.submissionId,
                                (feedback) => ({
                                  ...feedback,
                                  teacherSummary: event.target.value,
                                }),
                              )
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
                              updateFeedbackDraft(
                                result.submissionId,
                                (feedback) => ({
                                  ...feedback,
                                  studentFeedback: event.target.value
                                    .split("\n")
                                    .map((line) => line.trim())
                                    .filter(Boolean),
                                }),
                              )
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
                Select an assignment and run a batch to populate the review
                dashboard.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
