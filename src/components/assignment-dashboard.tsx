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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewState = "index" | "create" | "review";

interface AssignmentDashboardProps {
  hasOpenAIKey: boolean;
  initialAssignments: AssignmentBundle[];
  currentUserEmail: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  PromptSetEditor                                                    */
/* ------------------------------------------------------------------ */

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
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        padding: "22px",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="card-title">{title}</h3>
          <p
            style={{
              marginTop: "6px",
              fontSize: "14px",
              lineHeight: "1.6",
              color: "var(--ink-2)",
            }}
          >
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange((current) => [...current, emptyPromptDraft()])
          }
          className="btn btn-secondary"
        >
          Add prompt
        </button>
      </div>

      <div className="mt-5 space-y-5">
        {prompts.map((prompt, promptIndex) => (
          <div
            key={prompt.id}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "16px",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className="serif text-[28px] italic"
                  style={{ color: "var(--accent)" }}
                >
                  {promptIndex + 1}
                </div>
                <p
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    color: "var(--ink-3)",
                  }}
                >
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
                  className="btn btn-ghost btn-sm"
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
                  className="btn btn-ghost btn-sm"
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
                  className="btn btn-ghost btn-sm"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label
                className="grid gap-2 xl:col-span-2"
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--ink-2)",
                }}
              >
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
                  style={{
                    background: "var(--bg-sunk)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: "10px 12px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--ink)";
                    e.target.style.background = "var(--paper)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--line)";
                    e.target.style.background = "var(--bg-sunk)";
                  }}
                  placeholder="Part A: Literary analysis"
                />
              </label>
              <label
                className="grid gap-2"
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--ink-2)",
                }}
              >
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
                  style={{
                    background: "var(--bg-sunk)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: "10px 12px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--ink)";
                    e.target.style.background = "var(--paper)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--line)";
                    e.target.style.background = "var(--bg-sunk)";
                  }}
                >
                  <option value="essay">Essay</option>
                  <option value="short_answer">Short answer</option>
                </select>
              </label>
              <label
                className="grid gap-2"
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--ink-2)",
                }}
              >
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
                  style={{
                    background: "var(--bg-sunk)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: "10px 12px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--ink)";
                    e.target.style.background = "var(--paper)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--line)";
                    e.target.style.background = "var(--bg-sunk)";
                  }}
                  placeholder="Optional"
                />
              </label>
            </div>

            <label
              className="mt-4 grid gap-2"
              style={{
                fontSize: "13px",
                fontWeight: "500",
                color: "var(--ink-2)",
              }}
            >
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
                style={{
                  background: "var(--bg-sunk)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                  fontSize: "13px",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--ink)";
                  e.target.style.background = "var(--paper)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--line)";
                  e.target.style.background = "var(--bg-sunk)";
                }}
                placeholder="Explain what the student should write for this part."
              />
            </label>

            <label
              className="mt-4 grid gap-2"
              style={{
                fontSize: "13px",
                fontWeight: "500",
                color: "var(--ink-2)",
              }}
            >
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
                style={{
                  background: "var(--bg-sunk)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                  fontSize: "13px",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--ink)";
                  e.target.style.background = "var(--paper)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--line)";
                  e.target.style.background = "var(--bg-sunk)";
                }}
                placeholder="Optional override for this prompt."
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Index view                                                         */
/* ------------------------------------------------------------------ */

function AssignmentIndexView({
  assignments,
  onOpenAssignment,
  onNewAssignment,
}: {
  assignments: AssignmentBundle[];
  onOpenAssignment: (id: string) => void;
  onNewAssignment: () => void;
}) {
  if (assignments.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 20px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "15px",
            color: "var(--ink-3)",
            marginBottom: "16px",
          }}
        >
          No assignments yet.
        </p>
        <button
          type="button"
          onClick={onNewAssignment}
          className="btn btn-primary"
        >
          <PlusIcon size={14} />
          Create your first assignment
        </button>
      </div>
    );
  }

  return (
    <div className="assignments-grid">
      {assignments.map((bundle) => {
        const { assignment, results } = bundle;
        const promptCount = assignment.assignmentProfile.promptSet.length;
        const dimensionCount = assignment.normalizedRubric.dimensions.length;
        const gradedCount = results.length;

        return (
          <button
            type="button"
            key={assignment.id}
            className="assignment-card"
            onClick={() => onOpenAssignment(assignment.id)}
          >
            <div className="assignment-card-top">
              <span className="chip teal">
                {assignment.assignmentProfile.assignmentType}
              </span>
              <span className="chip">
                {assignment.courseProfile.subject}
              </span>
            </div>

            <div className="assignment-card-title">
              {assignment.assignmentName}
            </div>
            <div className="assignment-card-course">
              {assignment.courseProfile.courseName}
            </div>

            <div className="assignment-card-stats">
              <div>
                <div className="stat-num">{promptCount}</div>
                <div className="stat-label">Prompts</div>
              </div>
              <div>
                <div className="stat-num">{dimensionCount}</div>
                <div className="stat-label">Dimensions</div>
              </div>
              <div>
                <div className="stat-num">{gradedCount}</div>
                <div className="stat-label">Graded</div>
              </div>
            </div>

            <div className="assignment-card-footer">
              <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                created {formatDate(assignment.createdAt)}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                Open <ChevronRightIcon size={12} />
              </span>
            </div>
          </button>
        );
      })}

      {/* New assignment card */}
      <button
        type="button"
        className="assignment-card new-card"
        onClick={onNewAssignment}
      >
        <PlusIcon size={20} />
        <span style={{ fontSize: "13px", fontWeight: 500 }}>
          New assignment
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create form view                                                   */
/* ------------------------------------------------------------------ */

function CreateFormView({
  assignmentForm,
  setAssignmentForm,
  hasOpenAIKey,
  isPending,
  buttonLabel,
  onSubmit,
}: {
  assignmentForm: AssignmentFormDraft;
  setAssignmentForm: React.Dispatch<React.SetStateAction<AssignmentFormDraft>>;
  hasOpenAIKey: boolean;
  isPending: boolean;
  buttonLabel: string;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        padding: "22px",
      }}
    >
      <h2 className="card-title">Create Assignment</h2>
      <p
        style={{
          marginTop: "8px",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "var(--ink-2)",
        }}
      >
        Upload the rubric once, give the assignment core metadata, and let
        the model infer the prompt set and grading structure. If this fails,
        the exact backend error appears in the diagnostics panel.
      </p>

      <form action={onSubmit} className="grid gap-5 mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
              placeholder="Hamlet close reading"
            />
          </label>
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
              placeholder="English 11"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
              placeholder="English"
            />
          </label>
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
            >
              <option value="high_school">High school</option>
              <option value="college">College</option>
              <option value="ap">AP</option>
              <option value="esl">ESL</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
            >
              <option value="Essay">Essay</option>
              <option value="Short Answers">Short Answers</option>
            </select>
          </label>
        </div>

        <label
          className="grid gap-2"
          style={{
            fontSize: "13px",
            fontWeight: "500",
            color: "var(--ink-2)",
          }}
        >
          Rubric file
          <input
            required
            name="rubricFile"
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            style={{
              border: "1px dashed var(--line)",
              background: "var(--bg-sunk)",
              borderRadius: "var(--radius)",
              padding: "22px",
              textAlign: "center",
              fontSize: "13px",
            }}
          />
        </label>
        <label
          className="grid gap-2"
          style={{
            fontSize: "13px",
            fontWeight: "500",
            color: "var(--ink-2)",
          }}
        >
          Readings and source materials
          <input
            multiple
            name="readingFiles"
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            style={{
              border: "1px dashed var(--line)",
              background: "var(--bg-sunk)",
              borderRadius: "var(--radius)",
              padding: "22px",
              textAlign: "center",
              fontSize: "13px",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={isPending || !hasOpenAIKey}
          className="btn btn-primary"
          style={{
            opacity: isPending || !hasOpenAIKey ? "0.5" : "1",
            cursor: isPending || !hasOpenAIKey ? "not-allowed" : "pointer",
          }}
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Review view                                                        */
/* ------------------------------------------------------------------ */

function ReviewView({
  selectedBundle,
  selectedPromptDrafts,
  setSelectedPromptDrafts,
  rubricDraft,
  setRubricDraft,
  isPending,
  buttonLabel,
  onSave,
}: {
  selectedBundle: AssignmentBundle;
  selectedPromptDrafts: AssignmentPromptDraft[];
  setSelectedPromptDrafts: React.Dispatch<
    React.SetStateAction<AssignmentPromptDraft[]>
  >;
  rubricDraft: RubricFormDraft;
  setRubricDraft: React.Dispatch<React.SetStateAction<RubricFormDraft>>;
  isPending: boolean;
  buttonLabel: string;
  onSave: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="chip">
          Assignment: {selectedBundle.assignment.assignmentName}
        </div>
        <div className="chip">
          Level: {selectedBundle.assignment.courseProfile.level}
        </div>
        <div className="chip">
          Prompts: {selectedPromptDrafts.length}
        </div>
        <div className="chip">
          Assets: {selectedBundle.assignment.assets.length}
        </div>
      </div>

      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: "16px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: "500",
            color: "var(--ink)",
          }}
        >
          Context summary
        </div>
        <pre
          style={{
            marginTop: "12px",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "1.6",
            color: "var(--ink-2)",
          }}
        >
          {selectedBundle.assignment.contextSummary}
        </pre>
      </div>

      <div className="flex gap-3">
        <Link
          href="/grading"
          className="btn btn-secondary"
        >
          Open grading workspace
        </Link>
        <button
          type="button"
          onClick={() => downloadResults(selectedBundle)}
          className="btn btn-secondary"
        >
          Export JSON
        </button>
      </div>

      <PromptSetEditor
        prompts={selectedPromptDrafts}
        onChange={setSelectedPromptDrafts}
        title="Editable prompt set"
        description="These prompts define segmentation and per-prompt grading. Save them together with the rubric."
      />

      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          padding: "22px",
        }}
      >
        <h3 className="card-title">Rubric setup</h3>
        <p
          style={{
            marginTop: "6px",
            fontSize: "14px",
            lineHeight: "1.6",
            color: "var(--ink-2)",
          }}
        >
          Edit the structured rubric the model uses during scoring. Each
          criterion can apply globally or to specific prompts only.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
            Rubric ID
            <input
              value={rubricDraft.rubricId}
              onChange={(event) =>
                setRubricDraft((current) => ({
                  ...current,
                  rubricId: event.target.value,
                }))
              }
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
            />
          </label>
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
            >
              <option value="analytic">Analytic</option>
              <option value="holistic">Holistic</option>
            </select>
          </label>
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
            />
          </label>
          <label
            className="grid gap-2"
            style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--ink-2)",
            }}
          >
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
              style={{
                background: "var(--bg-sunk)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                fontSize: "13px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ink)";
                e.target.style.background = "var(--paper)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--line)";
                e.target.style.background = "var(--bg-sunk)";
              }}
            />
          </label>
        </div>
      </div>

      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          padding: "22px",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="card-title">Hard requirements</h3>
            <p
              style={{
                marginTop: "6px",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "var(--ink-2)",
              }}
            >
              Non-negotiable expectations such as citation rules or required
              evidence.
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
            className="btn btn-secondary"
          >
            Add requirement
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {rubricDraft.hardRequirements.map(
            (requirement, requirementIndex) => (
              <div
                key={`req-${String(requirementIndex)}`}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: "16px",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <label
                    className="grid flex-1 gap-2"
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "var(--ink-2)",
                    }}
                  >
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
                      style={{
                        background: "var(--bg-sunk)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius)",
                        padding: "10px 12px",
                        fontSize: "13px",
                        outline: "none",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--ink)";
                        e.target.style.background = "var(--paper)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--line)";
                        e.target.style.background = "var(--bg-sunk)";
                      }}
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
                    className="btn btn-ghost btn-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          padding: "22px",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="card-title">Criteria and score bands</h3>
            <p
              style={{
                marginTop: "6px",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "var(--ink-2)",
              }}
            >
              Scope each criterion globally or to one or more prompts, then
              define the score bands.
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
            className="btn btn-secondary"
          >
            Add criterion
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {rubricDraft.dimensions.map((dimension, dimensionIndex) => (
            <div
              key={`dim-${dimension.name}-${String(dimensionIndex)}`}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "16px",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "var(--ink)",
                    }}
                  >
                    Criterion {dimensionIndex + 1}
                  </div>
                  <p
                    style={{
                      marginTop: "4px",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      color: "var(--ink-3)",
                    }}
                  >
                    Define what is graded, how much it matters, and whether
                    it applies globally or to selected prompts.
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
                  className="btn btn-ghost btn-sm"
                >
                  Remove criterion
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <label
                  className="grid gap-2 xl:col-span-2"
                  style={{
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "var(--ink-2)",
                  }}
                >
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
                    style={{
                      background: "var(--bg-sunk)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      padding: "10px 12px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--ink)";
                      e.target.style.background = "var(--paper)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--line)";
                      e.target.style.background = "var(--bg-sunk)";
                    }}
                  />
                </label>
                <label
                  className="grid gap-2"
                  style={{
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "var(--ink-2)",
                  }}
                >
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
                    style={{
                      background: "var(--bg-sunk)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      padding: "10px 12px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--ink)";
                      e.target.style.background = "var(--paper)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--line)";
                      e.target.style.background = "var(--bg-sunk)";
                    }}
                  >
                    <option value="global">Global</option>
                    <option value="prompt">Prompt-specific</option>
                  </select>
                </label>
                <label
                  className="grid gap-2"
                  style={{
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "var(--ink-2)",
                  }}
                >
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
                    style={{
                      background: "var(--bg-sunk)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      padding: "10px 12px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--ink)";
                      e.target.style.background = "var(--paper)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--line)";
                      e.target.style.background = "var(--bg-sunk)";
                    }}
                  />
                </label>
                <label
                  className="grid gap-2"
                  style={{
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "var(--ink-2)",
                  }}
                >
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
                    style={{
                      background: "var(--bg-sunk)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      padding: "10px 12px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--ink)";
                      e.target.style.background = "var(--paper)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--line)";
                      e.target.style.background = "var(--bg-sunk)";
                    }}
                  />
                </label>
              </div>

              {dimension.scope === "prompt" ? (
                <div className="mt-4">
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "var(--ink-2)",
                    }}
                  >
                    Applies to prompts
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedPromptDrafts.map((prompt) => {
                      const isSelected = dimension.promptIds.includes(
                        prompt.id,
                      );
                      return (
                        <button
                          key={prompt.id}
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
                          style={{
                            borderRadius: "999px",
                            border: isSelected
                              ? "1px solid var(--ink)"
                              : "1px solid var(--line)",
                            padding: "4px 12px",
                            fontSize: "12px",
                            background: isSelected
                              ? "var(--ink)"
                              : "var(--paper)",
                            color: isSelected
                              ? "var(--bg)"
                              : "var(--ink-2)",
                          }}
                        >
                          {prompt.title ||
                            `Prompt ${selectedPromptDrafts.indexOf(prompt) + 1}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <label
                className="mt-4 grid gap-2"
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--ink-2)",
                }}
              >
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
                  style={{
                    background: "var(--bg-sunk)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: "10px 12px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--ink)";
                    e.target.style.background = "var(--paper)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--line)";
                    e.target.style.background = "var(--bg-sunk)";
                  }}
                />
              </label>

              <div
                className="mt-5"
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--paper)",
                  overflow: "hidden",
                  padding: "16px",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "var(--ink)",
                      }}
                    >
                      Performance bands
                    </div>
                    <p
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        lineHeight: "1.5",
                        color: "var(--ink-3)",
                      }}
                    >
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
                                  bands: [...entry.bands, emptyBandDraft()],
                                }
                              : entry,
                        ),
                      }))
                    }
                    className="btn btn-secondary"
                  >
                    Add band
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {dimension.bands.map((band, bandIndex) => (
                    <div
                      key={`band-${band.label}-${String(bandIndex)}`}
                      style={{
                        background: "var(--bg-sunk)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius)",
                        padding: "16px",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "500",
                              color: "var(--ink)",
                            }}
                          >
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
                          className="btn btn-ghost btn-sm"
                        >
                          Remove band
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <label
                          className="grid gap-2"
                          style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "var(--ink-2)",
                          }}
                        >
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
                                                    label:
                                                      event.target.value,
                                                  }
                                                : bandEntry,
                                          ),
                                        }
                                      : entry,
                                ),
                              }))
                            }
                            style={{
                              background: "var(--paper)",
                              border: "1px solid var(--line)",
                              borderRadius: "var(--radius)",
                              padding: "10px 12px",
                              fontSize: "13px",
                              outline: "none",
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = "var(--ink)";
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = "var(--line)";
                            }}
                          />
                        </label>
                        <label
                          className="grid gap-2"
                          style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "var(--ink-2)",
                          }}
                        >
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
                            style={{
                              background: "var(--paper)",
                              border: "1px solid var(--line)",
                              borderRadius: "var(--radius)",
                              padding: "10px 12px",
                              fontSize: "13px",
                              outline: "none",
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = "var(--ink)";
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = "var(--line)";
                            }}
                          />
                        </label>
                        <label
                          className="grid gap-2"
                          style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "var(--ink-2)",
                          }}
                        >
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
                            style={{
                              background: "var(--paper)",
                              border: "1px solid var(--line)",
                              borderRadius: "var(--radius)",
                              padding: "10px 12px",
                              fontSize: "13px",
                              outline: "none",
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = "var(--ink)";
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = "var(--line)";
                            }}
                          />
                        </label>
                      </div>

                      <label
                        className="mt-4 grid gap-2"
                        style={{
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "var(--ink-2)",
                        }}
                      >
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
                          style={{
                            background: "var(--paper)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius)",
                            padding: "10px 12px",
                            fontSize: "13px",
                            outline: "none",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "var(--ink)";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "var(--line)";
                          }}
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
        onClick={onSave}
        disabled={isPending}
        className="btn btn-primary"
        style={{
          opacity: isPending ? "0.5" : "1",
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AssignmentDashboard({
  hasOpenAIKey,
  initialAssignments,
  currentUserEmail,
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
  const [view, setView] = useState<ViewState>("index");

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
      setView("review");
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

  function handleSelectAssignment(id: string) {
    setSelectedAssignmentId(id);
    setRubricDraft(rubricFormFor(id, assignments));
    setSelectedPromptDrafts(promptSetDraftFor(id, assignments));
    setView("review");
  }

  function handleNewAssignment() {
    setView("create");
  }

  function handleBackToIndex() {
    setView("index");
  }

  /* ---- Topbar configuration per view ---- */

  function buildBreadcrumbs(): Array<{ label: string; muted?: boolean; onClick?: () => void }> {
    switch (view) {
      case "index":
        return [
          { label: "Dashboard" },
          { label: "All assignments", muted: true },
        ];
      case "create":
        return [
          { label: "\u2190 Assignments", onClick: handleBackToIndex },
          { label: "New assignment" },
        ];
      case "review":
        return [
          { label: "\u2190 Assignments", onClick: handleBackToIndex },
          { label: selectedBundle?.assignment.assignmentName ?? "Assignment" },
        ];
    }
  }

  function buildTabs(): Array<{ label: string; count?: number; active?: boolean; onClick?: () => void }> | undefined {
    switch (view) {
      case "index":
        return undefined;
      case "create":
        return [
          { label: "Setup", active: true },
        ];
      case "review":
        return [
          { label: "Context", active: true },
        ];
    }
  }

  function buildTopbarActions(): React.ReactNode {
    if (view === "index") {
      return (
        <button
          type="button"
          onClick={handleNewAssignment}
          className="btn btn-primary"
          style={{ padding: "7px 14px", fontSize: "12px" }}
        >
          <PlusIcon size={13} />
          New
        </button>
      );
    }
    return undefined;
  }

  /* ---- Header for index view ---- */

  function renderViewHeader() {
    if (view !== "index") {
      return null;
    }

    return (
      <div className="view-header" style={{ marginBottom: "32px" }}>
        <div
          className="caps"
          style={{ color: "var(--accent)", marginBottom: "10px" }}
        >
          Assignments
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px" }}>
          <div>
            <h1 className="view-title">
              Your <em>assignments</em>.
            </h1>
            <p
              style={{
                color: "var(--ink-2)",
                fontSize: "15px",
                maxWidth: "620px",
                lineHeight: "1.55",
                marginTop: "12px",
              }}
            >
              Upload the rubric once, give the assignment core metadata, and let the
              model infer the prompt set and grading structure.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewAssignment}
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
          >
            <PlusIcon size={14} />
            New assignment
          </button>
        </div>
      </div>
    );
  }

  /* ---- Render ---- */

  return (
    <DashboardShell
      activePage="assignments"
      assignments={assignments}
      userEmail={currentUserEmail}
      hasOpenAIKey={hasOpenAIKey}
      title="Create and review written assignment context before grading."
      description="Build the assignment package once, let the model infer the prompt structure from the rubric, then inspect the normalized rubric and shared context before grading."
      status={status}
      error={error}
      currentTask={currentTask}
      activity={activity}
      selectedAssignmentId={selectedAssignmentId}
      onSelectAssignment={handleSelectAssignment}
      onNewAssignment={handleNewAssignment}
      breadcrumbs={buildBreadcrumbs()}
      tabs={buildTabs()}
      topbarActions={buildTopbarActions()}
    >
      {renderViewHeader()}

      {view === "index" && (
        <AssignmentIndexView
          assignments={assignments}
          onOpenAssignment={handleSelectAssignment}
          onNewAssignment={handleNewAssignment}
        />
      )}

      {view === "create" && (
        <CreateFormView
          assignmentForm={assignmentForm}
          setAssignmentForm={setAssignmentForm}
          hasOpenAIKey={hasOpenAIKey}
          isPending={isPending}
          buttonLabel={buttonLabel(
            "Create assignment",
            "Creating assignment and indexing shared context...",
          )}
          onSubmit={handleCreateAssignment}
        />
      )}

      {view === "review" && selectedBundle && (
        <ReviewView
          selectedBundle={selectedBundle}
          selectedPromptDrafts={selectedPromptDrafts}
          setSelectedPromptDrafts={setSelectedPromptDrafts}
          rubricDraft={rubricDraft}
          setRubricDraft={setRubricDraft}
          isPending={isPending}
          buttonLabel={buttonLabel(
            "Save prompt set and rubric",
            "Saving prompts and rubric...",
          )}
          onSave={handleSaveAssignmentConfig}
        />
      )}
    </DashboardShell>
  );
}
