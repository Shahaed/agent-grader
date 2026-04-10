import { promises as fs } from "node:fs";
import path from "node:path";

import { zodTextFormat } from "openai/helpers/zod";

import { extractTextFromFile } from "@/lib/file-text";
import { getOpenAIClient, models } from "@/lib/openai";
import {
  calibrationOutputSchema,
  feedbackOutputSchema,
  gradingOutputSchema,
} from "@/lib/schemas";
import {
  assignmentAssetDir,
  loadAssignment,
  loadAssignmentBundle,
  loadResults,
  saveAssignment,
  saveCalibration,
  saveResult,
} from "@/lib/storage";
import type {
  AssignmentRecord,
  CalibrationRecord,
  GradingFeedback,
  GradingResultRecord,
  StoredAsset,
} from "@/lib/types";
import { clamp, createId, isoNow, splitIntoEvidenceSpans, sumRubricScale } from "@/lib/utils";

function buildRetrievalFilters(assignmentId: string, courseLevel: string) {
  return {
    type: "and" as const,
    filters: [
      { type: "eq" as const, key: "assignment_id", value: assignmentId },
      {
        type: "in" as const,
        key: "asset_type",
        value: ["prompt", "reading", "anchor"],
      },
      { type: "eq" as const, key: "course_level", value: courseLevel },
    ],
  };
}

async function persistSubmissionFile(
  assignmentId: string,
  file: File,
): Promise<StoredAsset & { bytes: Buffer }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = `${Date.now()}-${file.name}`;
  const localPath = path.join(assignmentAssetDir(assignmentId), "essay", safeName);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, bytes);

  return {
    id: createId("asset"),
    assetType: "essay",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: bytes.byteLength,
    localPath,
    createdAt: isoNow(),
    bytes,
  };
}

function normalizeDimensions(result: GradingResultRecord, assignment: AssignmentRecord) {
  const rubricDimensions = assignment.normalizedRubric.dimensions;
  const normalized = rubricDimensions.map((rubricDimension) => {
    const match = result.dimensions.find(
      (dimension) =>
        dimension.name.trim().toLowerCase() === rubricDimension.name.trim().toLowerCase(),
    );

    if (match) {
      return {
        ...match,
        scaleMax: rubricDimension.scaleMax,
        score: clamp(match.score, 0, rubricDimension.scaleMax),
      };
    }

    return {
      name: rubricDimension.name,
      score: 0,
      scaleMax: rubricDimension.scaleMax,
      rationale: "The model did not return this rubric dimension.",
      evidenceSpans: [],
      confidence: 0.2,
      flags: ["missing_dimension_output"],
    };
  });

  result.dimensions = normalized;
  result.scaleMax = assignment.normalizedRubric.totalScaleMax || sumRubricScale(assignment.normalizedRubric);
  result.overallScore = clamp(
    normalized.reduce((total, dimension) => total + dimension.score, 0),
    0,
    result.scaleMax,
  );
  result.confidence =
    normalized.reduce((total, dimension) => total + dimension.confidence, 0) / normalized.length;

  const lowConfidence = normalized.some((dimension) => dimension.confidence < 0.65);
  const missingEvidence = normalized.some((dimension) => dimension.evidenceSpans.length === 0);
  const reasons = new Set(result.review.reasons);

  if (lowConfidence) {
    reasons.add("low_confidence_dimension");
  }

  if (missingEvidence) {
    reasons.add("thin_evidence_mapping");
  }

  result.review = {
    needsHumanReview: result.review.needsHumanReview || lowConfidence || missingEvidence,
    reasons: [...reasons],
  };

  return result;
}

async function writeFeedback(
  assignment: AssignmentRecord,
  result: Omit<GradingResultRecord, "feedback">,
) {
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: models.feedback,
    store: false,
    instructions: [
      "You write teacher-facing and student-facing essay feedback.",
      "Use only the supplied structured grading evidence.",
      "Do not introduce new reasons for the score.",
      "Be specific, concise, and aligned with the rubric.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                teacher_preferences: assignment.courseProfile.teacherPreferences,
                citation_expectations: assignment.assignmentProfile.citationExpectations,
                grading_result: {
                  submissionId: result.submissionId,
                  submissionName: result.submissionName,
                  overallScore: result.overallScore,
                  scaleMax: result.scaleMax,
                  dimensions: result.dimensions,
                  review: result.review,
                },
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(feedbackOutputSchema, "grading_feedback"),
    },
  });

  const feedback = response.output_parsed;
  if (!feedback) {
    throw new Error("The model did not return grading feedback.");
  }

  return feedback satisfies GradingFeedback;
}

function extractRetrievalSources(response: Awaited<ReturnType<ReturnType<typeof getOpenAIClient>["responses"]["parse"]>>) {
  const sources = new Set<string>();

  for (const item of response.output) {
    if (item.type !== "file_search_call" || !("results" in item) || !item.results) {
      continue;
    }

    for (const result of item.results) {
      if ("filename" in result && result.filename) {
        sources.add(result.filename);
      }
    }
  }

  return [...sources];
}

async function gradeSingleSubmission(assignment: AssignmentRecord, file: File) {
  const client = getOpenAIClient();
  const sourceAsset = await persistSubmissionFile(assignment.id, file);
  const essayText = await extractTextFromFile(file);
  const annotatedEssay = splitIntoEvidenceSpans(essayText);
  const submissionId = createId("submission");

  const response = await client.responses.parse({
    model: models.grading,
    store: false,
    include: ["file_search_call.results"],
    instructions: [
      "You grade exactly one student essay at a time.",
      "Never compare the submission to other students.",
      "The rubric is the primary authority. The level profile only adjusts strictness and tone.",
      "If readings are available, use file search only for shared assignment materials.",
      "All evidence_spans must reference the tagged essay span ids exactly.",
      "Flag uncertain or borderline cases for human review.",
    ].join(" "),
    tools: assignment.vectorStoreId
      ? [
          {
            type: "file_search" as const,
            vector_store_ids: [assignment.vectorStoreId],
            max_num_results: 8,
            filters: buildRetrievalFilters(
              assignment.id,
              assignment.courseProfile.level,
            ),
          },
        ]
      : [],
    tool_choice: assignment.vectorStoreId ? "auto" : "none",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Submission ID: ${submissionId}`,
              `Submission name: ${file.name}`,
              `Course level: ${assignment.courseProfile.level}`,
              `Level profile: ${assignment.levelProfile}`,
              `Course summary:\n${assignment.contextSummary}`,
              `Normalized rubric JSON:\n${JSON.stringify(assignment.normalizedRubric, null, 2)}`,
              `Essay prompt:\n${assignment.assignmentProfile.essayPrompt}`,
              `Tagged essay with evidence span ids:\n${annotatedEssay.taggedEssay}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(gradingOutputSchema, "grading_result"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`The model did not return a grading result for ${file.name}.`);
  }

  const provisional: GradingResultRecord = {
    submissionId,
    submissionName: file.name,
    createdAt: isoNow(),
    overallScore: parsed.overallScore,
    scaleMax: parsed.scaleMax,
    confidence: parsed.confidence,
    dimensions: parsed.dimensions,
    review: parsed.review,
    feedback: {
      teacherSummary: "",
      studentFeedback: [],
    },
    evidenceLookup: annotatedEssay.spanLookup,
    retrievalSources: extractRetrievalSources(response),
    sourceAsset,
  };

  const normalized = normalizeDimensions(provisional, assignment);
  normalized.feedback = await writeFeedback(assignment, normalized);

  await saveResult(assignment.id, normalized);
  return normalized;
}

export async function gradeSubmissionBatch(assignmentId: string, files: File[]) {
  if (files.length === 0) {
    throw new Error("Upload at least one student submission.");
  }

  const assignment = await loadAssignment(assignmentId);
  const results: GradingResultRecord[] = [];

  for (const file of files) {
    results.push(await gradeSingleSubmission(assignment, file));
  }

  assignment.updatedAt = isoNow();
  await saveAssignment(assignment);

  return results;
}

export async function updateResultFeedback(
  assignmentId: string,
  submissionId: string,
  feedback: GradingFeedback,
) {
  const bundle = await loadAssignmentBundle(assignmentId);
  const result = bundle.results.find((entry) => entry.submissionId === submissionId);

  if (!result) {
    throw new Error("Grading result not found.");
  }

  result.feedback = feedback;
  await saveResult(assignmentId, result);
  return result;
}

export async function runCalibrationPass(assignmentId: string) {
  const assignment = await loadAssignment(assignmentId);
  const results = await loadResults(assignmentId);

  if (results.length < 2) {
    throw new Error("Calibration requires at least two graded submissions.");
  }

  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: models.calibration,
    store: false,
    instructions: [
      "You run a post-pass calibration on independently graded essays.",
      "Do not regrade from scratch.",
      "Use the score distributions, flags, and confidence signals to identify possible outliers or inconsistent rubric application.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                assignment_id: assignment.id,
                rubric: assignment.normalizedRubric,
                results: results.map((result) => ({
                  submissionId: result.submissionId,
                  submissionName: result.submissionName,
                  overallScore: result.overallScore,
                  scaleMax: result.scaleMax,
                  confidence: result.confidence,
                  dimensionScores: result.dimensions.map((dimension) => ({
                    name: dimension.name,
                    score: dimension.score,
                    scaleMax: dimension.scaleMax,
                    confidence: dimension.confidence,
                    flags: dimension.flags,
                  })),
                  review: result.review,
                })),
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(calibrationOutputSchema, "calibration_summary"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("The model did not return a calibration result.");
  }

  const calibration: CalibrationRecord = {
    createdAt: isoNow(),
    batchSummary: parsed.batchSummary,
    patterns: parsed.patterns,
    flaggedSubmissions: parsed.flaggedSubmissions,
  };

  await saveCalibration(assignmentId, calibration);
  assignment.updatedAt = isoNow();
  await saveAssignment(assignment);

  return calibration;
}

