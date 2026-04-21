import { z } from "zod";

export const assignmentPromptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["essay", "long_answer", "short_answer", "written_response"]),
  instructions: z.string().min(1),
  citationExpectations: z.string().nullable().optional(),
  maxScore: z.number().positive().nullable().optional(),
  order: z.number().int().nonnegative(),
});

export const promptSetSchema = z.array(assignmentPromptSchema).min(1);

export const normalizedRubricSchema = z.object({
  rubricId: z.string().min(1),
  gradingMode: z.enum(["analytic", "holistic"]),
  totalScaleMax: z.number().positive(),
  dimensions: z
    .array(
      z.object({
        name: z.string().min(1),
        weight: z.number().min(0).max(1),
        scaleMax: z.number().positive(),
        descriptor: z.string().nullable(),
        bands: z
          .array(
            z.object({
              label: z.string().min(1),
              scoreRange: z.object({
                min: z.number(),
                max: z.number(),
              }),
              descriptor: z.string().min(1),
            }),
          )
          .min(1),
        scope: z.enum(["global", "prompt"]).default("global"),
        promptIds: z.array(z.string().min(1)).default([]),
      }),
    )
    .min(1),
  hardRequirements: z.array(z.string()).default([]),
  notes: z.string().nullable(),
});

export const assignmentAnalysisSchema = z.object({
  promptSet: promptSetSchema,
  normalizedRubric: normalizedRubricSchema,
});

export const gradingOutputSchema = z.object({
  promptId: z.string().min(1),
  overallScore: z.number().nonnegative(),
  scaleMax: z.number().positive(),
  confidence: z.number().min(0).max(1),
  dimensions: z
    .array(
      z.object({
        name: z.string().min(1),
        score: z.number().nonnegative(),
        scaleMax: z.number().positive(),
        rationale: z.string().min(1),
        evidenceSpans: z.array(z.string()).default([]),
        confidence: z.number().min(0).max(1),
        flags: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  review: z.object({
    needsHumanReview: z.boolean(),
    reasons: z.array(z.string()).default([]),
  }),
});

export const segmentationOutputSchema = z.object({
  submissionId: z.string().min(1),
  overallConfidence: z.number().min(0).max(1),
  unmatchedText: z.string().default(""),
  review: z.object({
    needsHumanReview: z.boolean(),
    reasons: z.array(z.string()).default([]),
  }),
  segments: z
    .array(
      z.object({
        promptId: z.string().min(1),
        answerText: z.string().default(""),
        evidenceSpans: z.array(z.string()).default([]),
        segmentationConfidence: z.number().min(0).max(1),
        isMissing: z.boolean(),
        notes: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

export const feedbackOutputSchema = z.object({
  teacherSummary: z.string().min(1),
  studentFeedback: z.array(z.string().min(1)).min(1).max(6),
});
