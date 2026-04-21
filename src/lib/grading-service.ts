import { promises as fs } from "node:fs";
import path from "node:path";

import { zodTextFormat } from "openai/helpers/zod";

import { extractTextFromFile } from "@/lib/file-text";
import { getOpenAIClient, models } from "@/lib/openai";
import {
  feedbackOutputSchema,
  gradingOutputSchema,
  segmentationOutputSchema,
} from "@/lib/schemas";
import {
  assignmentAssetDir,
  loadAssignment,
  loadAssignmentBundle,
  saveAssignment,
  saveResult,
} from "@/lib/storage";
import type {
  AssignmentPrompt,
  AssignmentRecord,
  GradingFeedback,
  GradingResultRecord,
  NormalizedRubric,
  PromptGradingResult,
  ReviewDecision,
  StoredAsset,
  SubmissionSegment,
} from "@/lib/types";
import {
  clamp,
  createId,
  isoNow,
  splitIntoEvidenceSpans,
  sumDimensionScale,
  sumRubricScale,
  uniqueStrings,
} from "@/lib/utils";

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
  const localPath = path.join(assignmentAssetDir(assignmentId), "submission", safeName);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, bytes);

  return {
    id: createId("asset"),
    assetType: "submission",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: bytes.byteLength,
    localPath,
    createdAt: isoNow(),
    bytes,
  };
}

function rubricForPrompt(
  assignment: AssignmentRecord,
  promptId: string,
): NormalizedRubric {
  const dimensions = assignment.normalizedRubric.dimensions.filter(
    (dimension) =>
      dimension.scope === "global" || dimension.promptIds.includes(promptId),
  );

  return {
    ...assignment.normalizedRubric,
    totalScaleMax: sumDimensionScale(dimensions) || assignment.normalizedRubric.totalScaleMax,
    dimensions,
  };
}

function normalizeDimensions(
  promptResult: Omit<PromptGradingResult, "feedback">,
  rubric: NormalizedRubric,
) {
  const normalized = rubric.dimensions.map((rubricDimension) => {
    const match = promptResult.dimensions.find(
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

  const scaleMax = rubric.totalScaleMax || sumRubricScale(rubric);
  const overallScore = clamp(
    normalized.reduce((total, dimension) => total + dimension.score, 0),
    0,
    scaleMax,
  );
  const confidence =
    normalized.reduce((total, dimension) => total + dimension.confidence, 0) /
    normalized.length;

  const lowConfidence = normalized.some((dimension) => dimension.confidence < 0.65);
  const missingEvidence = normalized.some((dimension) => dimension.evidenceSpans.length === 0);
  const reasons = new Set(promptResult.review.reasons);

  if (lowConfidence) {
    reasons.add("low_confidence_dimension");
  }

  if (missingEvidence) {
    reasons.add("thin_evidence_mapping");
  }

  return {
    ...promptResult,
    dimensions: normalized,
    scaleMax,
    overallScore,
    confidence,
    review: {
      needsHumanReview:
        promptResult.review.needsHumanReview || lowConfidence || missingEvidence,
      reasons: [...reasons],
    },
  };
}

async function writeFeedback(input: {
  assignment: AssignmentRecord;
  prompt?: AssignmentPrompt;
  gradingResult: {
    label: string;
    overallScore: number;
    scaleMax: number;
    confidence: number;
    dimensions?: PromptGradingResult["dimensions"];
    review: ReviewDecision;
    segmentNotes?: string[];
    promptResults?: Array<{
      promptId: string;
      promptTitle: string;
      score: number;
      scaleMax: number;
      review: ReviewDecision;
    }>;
  };
}) {
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: models.feedback,
    store: false,
    instructions: [
      "You write teacher-facing and student-facing writing feedback.",
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
                teacher_preferences: input.assignment.courseProfile.teacherPreferences,
                assignment_citation_expectations:
                  input.assignment.assignmentProfile.citationExpectations,
                prompt: input.prompt
                  ? {
                      id: input.prompt.id,
                      title: input.prompt.title,
                      type: input.prompt.type,
                      instructions: input.prompt.instructions,
                      citationExpectations: input.prompt.citationExpectations,
                    }
                  : null,
                grading_result: input.gradingResult,
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

function extractRetrievalSources(
  response: Awaited<ReturnType<ReturnType<typeof getOpenAIClient>["responses"]["parse"]>>,
) {
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

async function segmentSubmission(
  assignment: AssignmentRecord,
  submissionId: string,
  fileName: string,
  submissionText: string,
) {
  const client = getOpenAIClient();
  const annotatedSubmission = splitIntoEvidenceSpans(submissionText);
  const response = await client.responses.parse({
    model: models.segmentation,
    store: false,
    instructions: [
      "You segment one student submission into answers for a known prompt set.",
      "Map each prompt to the best matching text from the tagged submission.",
      "Never invent text for missing answers.",
      "Use the exact span ids from the tagged submission in evidence_spans.",
      "If a prompt is unanswered, set is_missing to true and leave answer_text empty.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Submission ID: ${submissionId}`,
              `Submission name: ${fileName}`,
              `Prompt set JSON:\n${JSON.stringify(assignment.assignmentProfile.promptSet, null, 2)}`,
              `Tagged submission with evidence span ids:\n${annotatedSubmission.taggedText}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(segmentationOutputSchema, "submission_segmentation"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`The model did not return segmentation data for ${fileName}.`);
  }

  const segmentMap = new Map(parsed.segments.map((segment) => [segment.promptId, segment]));

  return {
    overallConfidence: parsed.overallConfidence,
    unmatchedText: parsed.unmatchedText,
    review: parsed.review,
    segments: assignment.assignmentProfile.promptSet.map((prompt) => {
      const match = segmentMap.get(prompt.id);
      const sourceEvidenceSpans = match?.evidenceSpans || [];
      const sourceEvidenceLookup = Object.fromEntries(
        sourceEvidenceSpans.map((spanId) => [
          spanId,
          annotatedSubmission.spanLookup[spanId] || "Span excerpt unavailable.",
        ]),
      );
      const answerText =
        match?.answerText?.trim() ||
        sourceEvidenceSpans
          .map((spanId) => annotatedSubmission.spanLookup[spanId])
          .filter(Boolean)
          .join("\n");
      const promptAnswer = splitIntoEvidenceSpans(answerText);

      return {
        promptId: prompt.id,
        promptTitle: prompt.title,
        promptType: prompt.type,
        answerText,
        taggedAnswer: promptAnswer.taggedText,
        sourceEvidenceSpans,
        sourceEvidenceLookup,
        evidenceLookup: promptAnswer.spanLookup,
        segmentationConfidence: match?.segmentationConfidence ?? 0,
        isMissing: match?.isMissing ?? !answerText,
        notes: match?.notes || [],
      } satisfies SubmissionSegment;
    }),
  };
}

async function gradePrompt(
  assignment: AssignmentRecord,
  prompt: AssignmentPrompt,
  segment: SubmissionSegment,
) {
  const client = getOpenAIClient();
  const rubric = rubricForPrompt(assignment, prompt.id);
  const response = await client.responses.parse({
    model: models.grading,
    store: false,
    include: ["file_search_call.results"],
    instructions: [
      "You grade exactly one prompt response at a time.",
      "Never compare the submission to other students.",
      "The rubric is the primary authority.",
      "Use file search only for shared assignment materials.",
      "All evidence_spans must reference the tagged prompt answer span ids exactly.",
      "Flag uncertain or borderline cases for human review.",
      "If the prompt answer is missing, assign zero scores and explain that the prompt appears unanswered.",
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
              `Prompt ID: ${prompt.id}`,
              `Prompt title: ${prompt.title}`,
              `Prompt type: ${prompt.type}`,
              `Course level: ${assignment.courseProfile.level}`,
              `Level profile: ${assignment.levelProfile}`,
              `Course summary:\n${assignment.contextSummary}`,
              `Prompt JSON:\n${JSON.stringify(prompt, null, 2)}`,
              `Prompt-specific rubric JSON:\n${JSON.stringify(rubric, null, 2)}`,
              `Segmentation metadata:\n${JSON.stringify(
                {
                  segmentationConfidence: segment.segmentationConfidence,
                  isMissing: segment.isMissing,
                  notes: segment.notes,
                  sourceEvidenceSpans: segment.sourceEvidenceSpans,
                },
                null,
                2,
              )}`,
              `Tagged prompt answer with evidence span ids:\n${segment.taggedAnswer || "[no extracted answer text]"}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(gradingOutputSchema, "prompt_grading_result"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(
      `The model did not return a grading result for ${prompt.title}.`,
    );
  }

  const provisional = normalizeDimensions(
    {
      promptId: prompt.id,
      promptTitle: prompt.title,
      promptType: prompt.type,
      overallScore: parsed.overallScore,
      scaleMax: parsed.scaleMax,
      confidence: parsed.confidence,
      dimensions: parsed.dimensions,
      review: parsed.review,
      segment,
      retrievalSources: extractRetrievalSources(response),
    },
    rubric,
  );

  return {
    ...provisional,
    feedback: await writeFeedback({
      assignment,
      prompt,
      gradingResult: {
        label: prompt.title,
        overallScore: provisional.overallScore,
        scaleMax: provisional.scaleMax,
        confidence: provisional.confidence,
        dimensions: provisional.dimensions,
        review: provisional.review,
        segmentNotes: provisional.segment.notes,
      },
    }),
  } satisfies PromptGradingResult;
}

function aggregatePromptResults(
  assignment: AssignmentRecord,
  promptResults: PromptGradingResult[],
  segmentationReview: ReviewDecision,
  unmatchedText: string,
) {
  const totalScaleMax =
    assignment.normalizedRubric.totalScaleMax || sumRubricScale(assignment.normalizedRubric);
  const totalWeight = promptResults.reduce(
    (sum, promptResult) =>
      sum +
      (assignment.assignmentProfile.promptSet.find(
        (prompt) => prompt.id === promptResult.promptId,
      )?.maxScore || 1),
    0,
  );

  const normalizedScore =
    promptResults.reduce((sum, promptResult) => {
      const weight =
        assignment.assignmentProfile.promptSet.find(
          (prompt) => prompt.id === promptResult.promptId,
        )?.maxScore || 1;
      const ratio = promptResult.scaleMax > 0 ? promptResult.overallScore / promptResult.scaleMax : 0;
      return sum + ratio * weight;
    }, 0) / Math.max(totalWeight, 1);

  const overallScore = clamp(
    Number((normalizedScore * totalScaleMax).toFixed(2)),
    0,
    totalScaleMax,
  );
  const confidence =
    promptResults.reduce((sum, promptResult) => sum + promptResult.confidence, 0) /
    Math.max(promptResults.length, 1);
  const reasons = uniqueStrings([
    ...segmentationReview.reasons,
    ...(unmatchedText ? ["unmatched_submission_text"] : []),
    ...promptResults.flatMap((promptResult) => promptResult.review.reasons),
  ]);

  return {
    overallScore,
    scaleMax: totalScaleMax,
    confidence,
    review: {
      needsHumanReview:
        segmentationReview.needsHumanReview ||
        Boolean(unmatchedText) ||
        promptResults.some((promptResult) => promptResult.review.needsHumanReview),
      reasons,
    },
    retrievalSources: uniqueStrings(
      promptResults.flatMap((promptResult) => promptResult.retrievalSources),
    ),
  };
}

async function gradeSingleSubmission(assignment: AssignmentRecord, file: File) {
  const sourceAsset = await persistSubmissionFile(assignment.id, file);
  const submissionText = await extractTextFromFile(file);
  const submissionId = createId("submission");
  const segmentation = await segmentSubmission(
    assignment,
    submissionId,
    file.name,
    submissionText,
  );

  const promptResults: PromptGradingResult[] = [];
  for (const prompt of assignment.assignmentProfile.promptSet) {
    const segment = segmentation.segments.find((entry) => entry.promptId === prompt.id);
    if (!segment) {
      throw new Error(`Missing segmentation record for prompt ${prompt.title}.`);
    }

    promptResults.push(await gradePrompt(assignment, prompt, segment));
  }

  const aggregate = aggregatePromptResults(
    assignment,
    promptResults,
    segmentation.review,
    segmentation.unmatchedText,
  );

  const result: GradingResultRecord = {
    schemaVersion: 2,
    submissionId,
    submissionName: file.name,
    createdAt: isoNow(),
    overallScore: aggregate.overallScore,
    scaleMax: aggregate.scaleMax,
    confidence: aggregate.confidence,
    promptResults,
    review: aggregate.review,
    feedback: {
      teacherSummary: "",
      studentFeedback: [],
    },
    retrievalSources: aggregate.retrievalSources,
    sourceAsset,
  };

  result.feedback = await writeFeedback({
    assignment,
    gradingResult: {
      label: file.name,
      overallScore: result.overallScore,
      scaleMax: result.scaleMax,
      confidence: result.confidence,
      review: result.review,
      promptResults: result.promptResults.map((promptResult) => ({
        promptId: promptResult.promptId,
        promptTitle: promptResult.promptTitle,
        score: promptResult.overallScore,
        scaleMax: promptResult.scaleMax,
        review: promptResult.review,
      })),
    },
  });

  await saveResult(assignment.id, result);
  return result;
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
  payload: {
    feedback: GradingFeedback;
    promptFeedback: Array<{
      promptId: string;
      feedback: GradingFeedback;
    }>;
  },
) {
  const bundle = await loadAssignmentBundle(assignmentId);
  const result = bundle.results.find((entry) => entry.submissionId === submissionId);

  if (!result) {
    throw new Error("Grading result not found.");
  }

  result.feedback = payload.feedback;
  result.promptResults = result.promptResults.map((promptResult) => {
    const promptFeedback = payload.promptFeedback.find(
      (entry) => entry.promptId === promptResult.promptId,
    );
    return promptFeedback
      ? {
          ...promptResult,
          feedback: promptFeedback.feedback,
        }
      : promptResult;
  });

  await saveResult(assignmentId, result);
  return result;
}
