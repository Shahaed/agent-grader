"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import type { AssignmentBundle } from "@/lib/types";

import { DashboardShell } from "./dashboard-shell";
import {
  assignmentDraftStorageKey,
  downloadResults,
  emptyAssignmentForm,
  emptyBandDraft,
  emptyDimensionDraft,
  emptyPromptDraft,
  normalizedRubricFromFormDraft,
  parseStoredAssignmentForm,
  parseStoredRubricDraft,
  promptSetDraftFor,
  readJson,
  readSessionStorage,
  resolveSelectedAssignmentId,
  rubricDraftStorageKey,
  rubricFormFor,
  selectedAssignmentStorageKey,
  serializePromptSetDraft,
  type AssignmentFormDraft,
  type AssignmentPromptDraft,
  type DiagnosticEvent,
  type RubricFormDraft,
} from "./dashboard-shared";

interface AssignmentDashboardProps {
  hasOpenAIKey: boolean;
  initialAssignments: AssignmentBundle[];
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function PromptSetEditor({
  prompts,
  onChange,
  title,
  description,
}: {
  prompts: AssignmentPromptDraft[];
  onChange: (
    updater: (current: AssignmentPromptDraft[]) => AssignmentPromptDraft[],
  ) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange((current) => [...current, emptyPromptDraft()])
          }
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
        >
          Add prompt
        </button>
      </div>

      <div className="mt-5 space-y-5">
        {prompts.map((prompt, promptIndex) => (
          <div
            key={prompt.id}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Prompt {promptIndex + 1}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Each prompt becomes its own segmented and graded response
                  unit.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) =>
                      moveItem(current, promptIndex, promptIndex - 1),
                    )
                  }
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-950"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) =>
                      moveItem(current, promptIndex, promptIndex + 1),
                    )
                  }
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-950"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) =>
                      current.length === 1
                        ? [emptyPromptDraft()]
                        : current.filter((entry) => entry.id !== prompt.id),
                    )
                  }
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
                Prompt title
                <input
                  value={prompt.title}
                  onChange={(event) =>
                    onChange((current) =>
                      current.map((entry) =>
                        entry.id === prompt.id
                          ? { ...entry, title: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="Part A: Literary analysis"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Prompt type
                <select
                  value={prompt.type}
                  onChange={(event) =>
                    onChange((current) =>
                      current.map((entry) =>
                        entry.id === prompt.id
                          ? {
                              ...entry,
                              type: event.target
                                .value as AssignmentPromptDraft["type"],
                            }
                          : entry,
                      ),
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                >
                  <option value="essay">Essay</option>
                  <option value="short_answer">Short answer</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Prompt max score
                <input
                  inputMode="decimal"
                  value={prompt.maxScore}
                  onChange={(event) =>
                    onChange((current) =>
                      current.map((entry) =>
                        entry.id === prompt.id
                          ? { ...entry, maxScore: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="Optional"
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
              Prompt instructions
              <textarea
                rows={4}
                value={prompt.instructions}
                onChange={(event) =>
                  onChange((current) =>
                    current.map((entry) =>
                      entry.id === prompt.id
                        ? { ...entry, instructions: event.target.value }
                        : entry,
                    ),
                  )
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                placeholder="Explain what the student should write for this part."
              />
            </label>

            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
              Prompt-specific citation expectations
              <textarea
                rows={2}
                value={prompt.citationExpectations}
                onChange={(event) =>
                  onChange((current) =>
                    current.map((entry) =>
                      entry.id === prompt.id
                        ? { ...entry, citationExpectations: event.target.value }
                        : entry,
                    ),
                  )
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                placeholder="Optional override for this prompt."
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssignmentDashboard({
  hasOpenAIKey,
  initialAssignments,
}: AssignmentDashboardProps) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(() =>
    resolveSelectedAssignmentId(
      [readSessionStorage(selectedAssignmentStorageKey)],
      initialAssignments,
    ),
  );
  const [rubricDraft, setRubricDraft] = useState<RubricFormDraft>(() =>
    parseStoredRubricDraft(
      readSessionStorage(rubricDraftStorageKey),
      rubricFormFor(
        resolveSelectedAssignmentId(
          [readSessionStorage(selectedAssignmentStorageKey)],
          initialAssignments,
        ),
        initialAssignments,
      ),
    ),
  );
  const [selectedPromptDrafts, setSelectedPromptDrafts] = useState(() =>
    promptSetDraftFor(
      resolveSelectedAssignmentId(
        [readSessionStorage(selectedAssignmentStorageKey)],
        initialAssignments,
      ),
      initialAssignments,
    ),
  );
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormDraft>(
    () =>
      parseStoredAssignmentForm(readSessionStorage(assignmentDraftStorageKey)),
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
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

    const resolvedSelectedId = resolveSelectedAssignmentId(
      [nextSelectedId, selectedAssignmentId],
      payload.assignments,
    );
    setSelectedAssignmentId(resolvedSelectedId);
    setRubricDraft(rubricFormFor(resolvedSelectedId, payload.assignments));
    setSelectedPromptDrafts(
      promptSetDraftFor(resolvedSelectedId, payload.assignments),
    );
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

  function buttonLabel(defaultLabel: string, activeLabel: string) {
    return currentTask === activeLabel || isPending
      ? "Working..."
      : defaultLabel;
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

  function handleSaveAssignmentConfig() {
    if (!selectedBundle) {
      return;
    }

    runTask("Saving prompts and rubric...", async () => {
      const promptsJson = serializePromptSetDraft(selectedPromptDrafts);
      const normalizedRubric = normalizedRubricFromFormDraft(
        rubricDraft,
        selectedPromptDrafts.map((prompt) => prompt.id),
      );
      const response = await fetch(
        `/api/assignments/${selectedBundle.assignment.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            promptsJson,
            rubricJson: JSON.stringify(normalizedRubric, null, 2),
          }),
        },
      );
      await readJson(response);
      await refreshAssignments(selectedBundle.assignment.id);
      setStatus("Assignment configuration updated.");
    });
  }

  return (
    <DashboardShell
      activePage="assignments"
      assignments={assignments}
      hasOpenAIKey={hasOpenAIKey}
      title="Create and review written assignment context before grading."
      description="Build the assignment package once, let the model infer the prompt structure from the rubric, then inspect the normalized rubric and shared context before grading."
      status={status}
      error={error}
      currentTask={currentTask}
      activity={activity}
    >
      <section className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">1. Create Assignment</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload the rubric once, give the assignment core metadata, and
              let the model infer the prompt set and grading structure.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              If this fails, the exact backend error appears in the diagnostics
              panel.
            </p>
          </div>
          <form action={handleCreateAssignment} className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Assignment name
                <input
                  required
                  name="assignmentName"
                  value={assignmentForm.assignmentName}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      assignmentName: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                  placeholder="Hamlet close reading"
                />
              </label>
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
                  placeholder="English 11"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
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
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Academic level
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
                <select
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
                >
                  <option value="Essay">Essay</option>
                  <option value="Short Answers">Short Answers</option>
                </select>
              </label>
            </div>

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

        <div className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                2. Review Assignment Context
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Select an assignment, inspect the prompt set and normalized
                rubric, then adjust both before grading starts.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <select
                value={selectedAssignmentId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedAssignmentId(nextId);
                  setRubricDraft(rubricFormFor(nextId, assignments));
                  setSelectedPromptDrafts(
                    promptSetDraftFor(nextId, assignments),
                  );
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
                    {bundle.assignment.assignmentName}
                  </option>
                ))}
              </select>
              {selectedBundle ? (
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/grading"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
                  >
                    Open grading workspace
                  </Link>
                  <button
                    type="button"
                    onClick={() => downloadResults(selectedBundle)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
                  >
                    Export JSON
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {selectedBundle ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Assignment
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {selectedBundle.assignment.assignmentName}
                  </div>
                </div>
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
                    Prompts
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {selectedPromptDrafts.length}
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
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="text-sm font-medium text-slate-900">
                  Context summary
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-6 text-slate-600">
                  {selectedBundle.assignment.contextSummary}
                </pre>
              </div>

              <PromptSetEditor
                prompts={selectedPromptDrafts}
                onChange={setSelectedPromptDrafts}
                title="Editable prompt set"
                description="These prompts define segmentation and per-prompt grading. Save them together with the rubric."
              />

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">
                  Rubric setup
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Edit the structured rubric the model uses during scoring. Each
                  criterion can apply globally or to specific prompts only.
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
                    />
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
                      Non-negotiable expectations such as citation rules or
                      required evidence.
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
                  {rubricDraft.hardRequirements.map(
                    (requirement, requirementIndex) => (
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
                                  hardRequirements:
                                    current.hardRequirements.map(
                                      (entry, entryIndex) =>
                                        entryIndex === requirementIndex
                                          ? event.target.value
                                          : entry,
                                    ),
                                }))
                              }
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                            />
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
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Criteria and score bands
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Scope each criterion globally or to one or more prompts,
                      then define the score bands.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRubricDraft((current) => ({
                        ...current,
                        dimensions: [
                          ...current.dimensions,
                          emptyDimensionDraft(),
                        ],
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
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Criterion {dimensionIndex + 1}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Define what is graded, how much it matters, and
                            whether it applies globally or to selected prompts.
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

                      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <label className="grid gap-2 text-sm font-medium text-slate-700 xl:col-span-2">
                          Criterion name
                          <input
                            value={dimension.name}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                dimensions: current.dimensions.map(
                                  (entry, entryIndex) =>
                                    entryIndex === dimensionIndex
                                      ? { ...entry, name: event.target.value }
                                      : entry,
                                ),
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Scope
                          <select
                            value={dimension.scope}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                dimensions: current.dimensions.map(
                                  (entry, entryIndex) =>
                                    entryIndex === dimensionIndex
                                      ? {
                                          ...entry,
                                          scope: event.target.value as
                                            | "global"
                                            | "prompt",
                                          promptIds:
                                            event.target.value === "global"
                                              ? []
                                              : entry.promptIds,
                                        }
                                      : entry,
                                ),
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                          >
                            <option value="global">Global</option>
                            <option value="prompt">Prompt-specific</option>
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Weight
                          <input
                            inputMode="decimal"
                            value={dimension.weight}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                dimensions: current.dimensions.map(
                                  (entry, entryIndex) =>
                                    entryIndex === dimensionIndex
                                      ? { ...entry, weight: event.target.value }
                                      : entry,
                                ),
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Max score
                          <input
                            inputMode="decimal"
                            value={dimension.scaleMax}
                            onChange={(event) =>
                              setRubricDraft((current) => ({
                                ...current,
                                dimensions: current.dimensions.map(
                                  (entry, entryIndex) =>
                                    entryIndex === dimensionIndex
                                      ? {
                                          ...entry,
                                          scaleMax: event.target.value,
                                        }
                                      : entry,
                                ),
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                          />
                        </label>
                      </div>

                      {dimension.scope === "prompt" ? (
                        <div className="mt-4">
                          <div className="text-sm font-medium text-slate-700">
                            Applies to prompts
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedPromptDrafts.map((prompt) => {
                              const isSelected = dimension.promptIds.includes(
                                prompt.id,
                              );
                              return (
                                <button
                                  key={`${dimensionIndex}-${prompt.id}`}
                                  type="button"
                                  onClick={() =>
                                    setRubricDraft((current) => ({
                                      ...current,
                                      dimensions: current.dimensions.map(
                                        (entry, entryIndex) => {
                                          if (entryIndex !== dimensionIndex) {
                                            return entry;
                                          }

                                          return {
                                            ...entry,
                                            promptIds: isSelected
                                              ? entry.promptIds.filter(
                                                  (promptId) =>
                                                    promptId !== prompt.id,
                                                )
                                              : [...entry.promptIds, prompt.id],
                                          };
                                        },
                                      ),
                                    }))
                                  }
                                  className={`rounded-full border px-3 py-1 text-xs ${
                                    isSelected
                                      ? "border-slate-950 bg-slate-950 text-white"
                                      : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {prompt.title ||
                                    `Prompt ${selectedPromptDrafts.indexOf(prompt) + 1}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                        Criterion description
                        <textarea
                          rows={3}
                          value={dimension.descriptor}
                          onChange={(event) =>
                            setRubricDraft((current) => ({
                              ...current,
                              dimensions: current.dimensions.map(
                                (entry, entryIndex) =>
                                  entryIndex === dimensionIndex
                                    ? {
                                        ...entry,
                                        descriptor: event.target.value,
                                      }
                                    : entry,
                              ),
                            }))
                          }
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                        />
                      </label>

                      <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              Performance bands
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Define the score ranges and what the writing looks
                              like in each range.
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
                                          bands: [
                                            ...entry.bands,
                                            emptyBandDraft(),
                                          ],
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
                                                          innerBandIndex !==
                                                          bandIndex,
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
                                                    (
                                                      bandEntry,
                                                      innerBandIndex,
                                                    ) =>
                                                      innerBandIndex ===
                                                      bandIndex
                                                        ? {
                                                            ...bandEntry,
                                                            label:
                                                              event.target
                                                                .value,
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
                                                    (
                                                      bandEntry,
                                                      innerBandIndex,
                                                    ) =>
                                                      innerBandIndex ===
                                                      bandIndex
                                                        ? {
                                                            ...bandEntry,
                                                            min: event.target
                                                              .value,
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
                                                    (
                                                      bandEntry,
                                                      innerBandIndex,
                                                    ) =>
                                                      innerBandIndex ===
                                                      bandIndex
                                                        ? {
                                                            ...bandEntry,
                                                            max: event.target
                                                              .value,
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
                                                  (
                                                    bandEntry,
                                                    innerBandIndex,
                                                  ) =>
                                                    innerBandIndex === bandIndex
                                                      ? {
                                                          ...bandEntry,
                                                          descriptor:
                                                            event.target.value,
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
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveAssignmentConfig}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buttonLabel(
                  "Save prompt set and rubric",
                  "Saving prompts and rubric...",
                )}
              </button>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
              Create an assignment first to review its context package.
            </div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
