import { z } from "zod";

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
      }),
    )
    .min(1),
  hardRequirements: z.array(z.string()).default([]),
  notes: z.string().nullable(),
});

export const gradingOutputSchema = z.object({
  submissionId: z.string().min(1),
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

export const feedbackOutputSchema = z.object({
  teacherSummary: z.string().min(1),
  studentFeedback: z.array(z.string().min(1)).min(1).max(6),
});

export const calibrationOutputSchema = z.object({
  batchSummary: z.string().min(1),
  patterns: z.array(z.string().min(1)).default([]),
  flaggedSubmissions: z.array(
    z.object({
      submissionId: z.string().min(1),
      submissionName: z.string().min(1),
      reasons: z.array(z.string().min(1)).default([]),
      recommendation: z.string().min(1),
    }),
  ),
});
