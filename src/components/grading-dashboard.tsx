"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import type { AssignmentBundle, GradingResultRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

import { DashboardShell } from "./dashboard-shell";
import {
  downloadResults,
  promptScoreLabel,
  readJson,
  readSessionStorage,
  resolveSelectedAssignmentId,
  scoreLabel,
  selectedAssignmentStorageKey,
  type DiagnosticEvent,
} from "./dashboard-shared";

interface GradingDashboardProps {
  hasOpenAIKey: boolean;
  initialAssignments: AssignmentBundle[];
}

export function GradingDashboard({
  hasOpenAIKey,
  initialAssignments,
}: GradingDashboardProps) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(() =>
    resolveSelectedAssignmentId(
      [readSessionStorage(selectedAssignmentStorageKey)],
      initialAssignments,
    ),
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

  function updateFeedbackDraft(
    submissionId: string,
    updater: (result: GradingResultRecord) => GradingResultRecord,
  ) {
    setAssignments((current) =>
      current.map((bundle) => {
        if (bundle.assignment.id !== selectedAssignmentId) {
          return bundle;
        }

        return {
          ...bundle,
          results: bundle.results.map((result) =>
            result.submissionId === submissionId ? updater(result) : result,
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
            promptFeedback: result.promptResults.map((promptResult) => ({
              promptId: promptResult.promptId,
              feedback: promptResult.feedback,
            })),
          }),
        },
      );
      await readJson(response);
      await refreshAssignments(selectedBundle.assignment.id);
      setStatus("Feedback saved.");
    });
  }

  return (
    <DashboardShell
      activePage="grading"
      assignments={assignments}
      hasOpenAIKey={hasOpenAIKey}
      title="Apply a saved assignment and grade written submissions."
      description="Pick a prepared assignment, confirm the prompt set and rubric that will govern scoring, then run isolated grading passes and review prompt-level results."
      status={status}
      error={error}
      currentTask={currentTask}
      activity={activity}
    >
      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                1. Select Prepared Assignment
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Choose the assignment package with a prompt set, shared context,
                and normalized rubric.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <select
                value={selectedAssignmentId}
                onChange={(event) => setSelectedAssignmentId(event.target.value)}
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
              <Link
                href="/assignments"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-950"
              >
                Edit assignments
              </Link>
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
                    Grading mode
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {selectedBundle.assignment.normalizedRubric.gradingMode}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Prompts
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {selectedBundle.assignment.assignmentProfile.promptSet.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Criteria
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {selectedBundle.assignment.normalizedRubric.dimensions.length}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="text-sm font-medium text-slate-900">
                  Prompt set
                </div>
                <div className="mt-4 grid gap-3">
                  {selectedBundle.assignment.assignmentProfile.promptSet.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-slate-900">
                          {prompt.title}
                        </div>
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                          {prompt.type}
                        </span>
                        {prompt.maxScore ? (
                          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                            Max {prompt.maxScore}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {prompt.instructions}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Normalized rubric snapshot
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      The rubric applied to each prompt response during grading.
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {selectedBundle.assignment.normalizedRubric.rubricId}
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {selectedBundle.assignment.normalizedRubric.dimensions.map(
                    (dimension) => (
                      <div
                        key={dimension.name}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-base font-semibold text-slate-900">
                              {dimension.name}
                            </div>
                            {dimension.descriptor ? (
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {dimension.descriptor}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700">
                              {dimension.scope === "global"
                                ? "Global"
                                : `Prompts: ${dimension.promptIds.length}`}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700">
                              Weight {dimension.weight}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700">
                              Max {dimension.scaleMax}
                            </span>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
              No prepared assignments are available yet. Create one on the
              assignments page first.
            </div>
          )}
        </div>

        <div className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">2. Grade Submissions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload multiple written submissions. The server segments each
                file by prompt, then grades each prompt in its own isolated run.
              </p>
            </div>
            {selectedBundle ? (
              <button
                type="button"
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
        </div>
      </section>

      <section className="rounded-4xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(87,61,33,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">3. Review Results</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Each submission stores prompt-level segmentation, scoring,
              evidence, review flags, retrieval sources, and editable feedback.
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
                      Overall teacher summary
                    </div>
                    <p className="mt-2">{result.feedback.teacherSummary}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-5">
                  {result.promptResults.map((promptResult) => (
                    <div
                      key={`${result.submissionId}-${promptResult.promptId}`}
                      className="rounded-3xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-slate-950">
                              {promptResult.promptTitle}
                            </div>
                            <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                              {promptResult.promptType}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                              {promptScoreLabel(promptResult)}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700">
                              Segmentation{" "}
                              {Math.round(
                                promptResult.segment.segmentationConfidence * 100,
                              )}
                              %
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-sm ${
                                promptResult.segment.isMissing
                                  ? "bg-rose-100 text-rose-900"
                                  : "bg-sky-100 text-sky-900"
                              }`}
                            >
                              {promptResult.segment.isMissing
                                ? "Marked missing"
                                : "Answer found"}
                            </span>
                          </div>
                        </div>

                        <div className="max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                          <div className="font-medium text-slate-900">
                            Prompt teacher summary
                          </div>
                          <p className="mt-2">{promptResult.feedback.teacherSummary}</p>
                        </div>
                      </div>

                      {promptResult.segment.notes.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {promptResult.segment.notes.map((note) => (
                            <span
                              key={`${promptResult.promptId}-${note}`}
                              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {promptResult.dimensions.map((dimension) => (
                          <div
                            key={`${promptResult.promptId}-${dimension.name}`}
                            className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-base font-semibold text-slate-950">
                                {dimension.name}
                              </div>
                              <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-800">
                                {dimension.score}/{dimension.scaleMax}
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              {dimension.rationale}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
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
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                                  >
                                    <span className="font-medium text-slate-900">
                                      {spanId}
                                    </span>{" "}
                                    {promptResult.segment.evidenceLookup[spanId] ||
                                      "Span excerpt unavailable."}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-sm font-medium text-slate-900">
                            Review reasons
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {promptResult.review.reasons.length ? (
                              promptResult.review.reasons.map((reason) => (
                                <span
                                  key={reason}
                                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-900"
                                >
                                  {reason}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-500">
                                No prompt review flags.
                              </span>
                            )}
                          </div>

                          <div className="mt-5 text-sm font-medium text-slate-900">
                            Retrieved sources
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {promptResult.retrievalSources.length ? (
                              promptResult.retrievalSources.map((source) => (
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

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="grid gap-4">
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Prompt teacher summary
                              <textarea
                                rows={4}
                                value={promptResult.feedback.teacherSummary}
                                onChange={(event) =>
                                  updateFeedbackDraft(result.submissionId, (current) => ({
                                    ...current,
                                    promptResults: current.promptResults.map((entry) =>
                                      entry.promptId === promptResult.promptId
                                        ? {
                                            ...entry,
                                            feedback: {
                                              ...entry.feedback,
                                              teacherSummary: event.target.value,
                                            },
                                          }
                                        : entry,
                                    ),
                                  }))
                                }
                                className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Prompt student feedback points
                              <textarea
                                rows={4}
                                value={promptResult.feedback.studentFeedback.join("\n")}
                                onChange={(event) =>
                                  updateFeedbackDraft(result.submissionId, (current) => ({
                                    ...current,
                                    promptResults: current.promptResults.map((entry) =>
                                      entry.promptId === promptResult.promptId
                                        ? {
                                            ...entry,
                                            feedback: {
                                              ...entry.feedback,
                                              studentFeedback: event.target.value
                                                .split("\n")
                                                .map((line) => line.trim())
                                                .filter(Boolean),
                                            },
                                          }
                                        : entry,
                                    ),
                                  }))
                                }
                                className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-900">
                      Overall review reasons
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
                      Submission-level retrieved sources
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
                          No retrieved sources.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="grid gap-4">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Overall teacher-facing summary
                        <textarea
                          rows={4}
                          value={result.feedback.teacherSummary}
                          onChange={(event) =>
                            updateFeedbackDraft(result.submissionId, (current) => ({
                              ...current,
                              feedback: {
                                ...current.feedback,
                                teacherSummary: event.target.value,
                              },
                            }))
                          }
                          className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-400"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Overall student feedback points
                        <textarea
                          rows={5}
                          value={result.feedback.studentFeedback.join("\n")}
                          onChange={(event) =>
                            updateFeedbackDraft(result.submissionId, (current) => ({
                              ...current,
                              feedback: {
                                ...current.feedback,
                                studentFeedback: event.target.value
                                  .split("\n")
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              },
                            }))
                          }
                          className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-400"
                        />
                      </label>
                      <button
                        type="button"
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
              workspace.
            </div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
