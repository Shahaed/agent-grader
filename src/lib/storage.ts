import os from "node:os";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import { normalizedRubricSchema, promptSetSchema } from "@/lib/schemas";
import type {
  AssignmentBundle,
  AssignmentPrompt,
  AssignmentRecord,
  GradingResultRecord,
  NormalizedRubric,
  PromptGradingResult,
  StoredAsset,
} from "@/lib/types";
import { createId, isoNow, sumRubricScale } from "@/lib/utils";

const LEGACY_DATA_ROOT = path.join(process.cwd(), ".data");
const DEFAULT_DATA_ROOT = path.join(os.homedir(), ".agent-grader-data");
const VERCEL_DATA_ROOT = path.join(os.tmpdir(), "agent-grader-data");
const DATA_ROOT =
  process.env.AGENT_GRADER_DATA_DIR ||
  (process.env.VERCEL ? VERCEL_DATA_ROOT :
  (existsSync(LEGACY_DATA_ROOT) && !existsSync(DEFAULT_DATA_ROOT)
    ? LEGACY_DATA_ROOT
    : DEFAULT_DATA_ROOT));
const ASSIGNMENTS_ROOT = path.join(DATA_ROOT, "assignments");

function assignmentDir(assignmentId: string) {
  return path.join(ASSIGNMENTS_ROOT, assignmentId);
}

function assignmentJsonPath(assignmentId: string) {
  return path.join(assignmentDir(assignmentId), "assignment.json");
}

function resultsDir(assignmentId: string) {
  return path.join(assignmentDir(assignmentId), "results");
}

export function assignmentAssetDir(assignmentId: string) {
  return path.join(assignmentDir(assignmentId), "assets");
}

export async function ensureDataRoot() {
  await fs.mkdir(ASSIGNMENTS_ROOT, { recursive: true });
}

export async function writeJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function readJson<T>(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function normalizeStoredAsset(asset: StoredAsset | Record<string, unknown>): StoredAsset {
  const assetType = String(asset.assetType || "reading");
  return {
    id: String(asset.id || createId("asset")),
    assetType: assetType === "essay" ? "submission" : (assetType as StoredAsset["assetType"]),
    name: String(asset.name || "asset"),
    mimeType: String(asset.mimeType || "application/octet-stream"),
    size: Number(asset.size || 0),
    localPath: String(asset.localPath || ""),
    openAiFileId:
      typeof asset.openAiFileId === "string" ? asset.openAiFileId : undefined,
    createdAt: String(asset.createdAt || isoNow()),
  };
}

function buildLegacyPrompt(rawAssignment: Record<string, unknown>): AssignmentPrompt {
  const assignmentProfile = (rawAssignment.assignmentProfile || {}) as Record<string, unknown>;
  return {
    id: "prompt_legacy",
    title: "Prompt 1",
    type: "essay",
    instructions: String(assignmentProfile.essayPrompt || "Legacy prompt"),
    citationExpectations:
      typeof assignmentProfile.citationExpectations === "string"
        ? assignmentProfile.citationExpectations
        : null,
    maxScore: null,
    order: 0,
  };
}

function normalizePromptSet(raw: Record<string, unknown>) {
  const assignmentProfile = (raw.assignmentProfile || {}) as Record<string, unknown>;
  const candidate = assignmentProfile.promptSet;

  if (Array.isArray(candidate) && candidate.length > 0) {
    return promptSetSchema.parse(candidate);
  }

  return [buildLegacyPrompt(raw)];
}

function normalizeRubric(raw: Record<string, unknown>, promptSet: AssignmentPrompt[]): NormalizedRubric {
  const candidate = (raw.normalizedRubric || {}) as Record<string, unknown>;
  const parsed = normalizedRubricSchema.parse({
    rubricId: candidate.rubricId || `rubric_${String(raw.id || "legacy")}`,
    gradingMode: candidate.gradingMode || "analytic",
    totalScaleMax: candidate.totalScaleMax || 0,
    dimensions: Array.isArray(candidate.dimensions)
      ? candidate.dimensions.map((dimension) => ({
          ...dimension,
          scope:
            dimension && typeof dimension === "object" && "scope" in dimension
              ? dimension.scope
              : "global",
          promptIds:
            dimension && typeof dimension === "object" && "promptIds" in dimension
              ? dimension.promptIds
              : [],
        }))
      : [],
    hardRequirements: candidate.hardRequirements || [],
    notes: candidate.notes ?? null,
  });

  parsed.dimensions = parsed.dimensions.map((dimension) => {
    if (dimension.scope === "prompt") {
      const validPromptIds = dimension.promptIds.filter((promptId) =>
        promptSet.some((prompt) => prompt.id === promptId),
      );
      return {
        ...dimension,
        promptIds: validPromptIds.length > 0 ? validPromptIds : [promptSet[0].id],
      };
    }

    return {
      ...dimension,
      scope: "global",
      promptIds: [],
    };
  });

  parsed.totalScaleMax ||= sumRubricScale(parsed);
  return parsed;
}

function upgradeAssignmentRecord(raw: Record<string, unknown>): AssignmentRecord {
  const promptSet = normalizePromptSet(raw);
  const normalizedRubric = normalizeRubric(raw, promptSet);

  return {
    schemaVersion: 2,
    id: String(raw.id || createId("assignment")),
    assignmentName: String(
      raw.assignmentName ||
        (raw.assignmentProfile as Record<string, unknown>)?.assignmentName ||
        (raw.courseProfile as Record<string, unknown>)?.courseName ||
        "Untitled assignment",
    ),
    createdAt: String(raw.createdAt || isoNow()),
    updatedAt: String(raw.updatedAt || raw.createdAt || isoNow()),
    courseProfile: {
      courseName: String((raw.courseProfile as Record<string, unknown>)?.courseName || ""),
      level: String((raw.courseProfile as Record<string, unknown>)?.level || "high_school") as AssignmentRecord["courseProfile"]["level"],
      subject: String((raw.courseProfile as Record<string, unknown>)?.subject || ""),
      teacherPreferences: String(
        (raw.courseProfile as Record<string, unknown>)?.teacherPreferences || "",
      ),
    },
    assignmentProfile: {
      assignmentType: String(
        (raw.assignmentProfile as Record<string, unknown>)?.assignmentType || "",
      ),
      citationExpectations: String(
        (raw.assignmentProfile as Record<string, unknown>)?.citationExpectations || "",
      ),
      promptSet,
    },
    levelProfile: String(raw.levelProfile || "high_school_argument") as AssignmentRecord["levelProfile"],
    rubricText: String(raw.rubricText || ""),
    normalizedRubric,
    vectorStoreId:
      typeof raw.vectorStoreId === "string" ? raw.vectorStoreId : undefined,
    contextSummary: String(raw.contextSummary || ""),
    assets: Array.isArray(raw.assets) ? raw.assets.map((asset) => normalizeStoredAsset(asset as Record<string, unknown>)) : [],
  };
}

function buildLegacyPromptResult(
  assignment: AssignmentRecord,
  raw: Record<string, unknown>,
) {
  const prompt = assignment.assignmentProfile.promptSet[0];
  const feedback = (raw.feedback || {}) as Record<string, unknown>;

  const promptResult: PromptGradingResult = {
    promptId: prompt.id,
    promptTitle: prompt.title,
    promptType: prompt.type,
    overallScore: Number(raw.overallScore || 0),
    scaleMax: Number(raw.scaleMax || assignment.normalizedRubric.totalScaleMax),
    confidence: Number(raw.confidence || 0),
    dimensions: Array.isArray(raw.dimensions) ? (raw.dimensions as PromptGradingResult["dimensions"]) : [],
    review: {
      needsHumanReview: Boolean((raw.review as Record<string, unknown>)?.needsHumanReview),
      reasons: Array.isArray((raw.review as Record<string, unknown>)?.reasons)
        ? ((raw.review as Record<string, unknown>).reasons as string[])
        : [],
    },
    feedback: {
      teacherSummary: String(feedback.teacherSummary || ""),
      studentFeedback: Array.isArray(feedback.studentFeedback)
        ? (feedback.studentFeedback as string[])
        : [],
    },
    segment: {
      promptId: prompt.id,
      promptTitle: prompt.title,
      promptType: prompt.type,
      answerText: "",
      taggedAnswer: "",
      sourceEvidenceSpans: [],
      sourceEvidenceLookup: {},
      evidenceLookup:
        typeof raw.evidenceLookup === "object" && raw.evidenceLookup
          ? (raw.evidenceLookup as Record<string, string>)
          : {},
      segmentationConfidence: 0,
      isMissing: false,
      notes: ["Legacy result migrated without explicit segmentation data."],
    },
    retrievalSources: Array.isArray(raw.retrievalSources)
      ? (raw.retrievalSources as string[])
      : [],
  };

  return promptResult;
}

function upgradeResultRecord(
  raw: Record<string, unknown>,
  assignment: AssignmentRecord,
): GradingResultRecord {
  if (raw.schemaVersion === 2 && Array.isArray(raw.promptResults)) {
    return {
      schemaVersion: 2,
      submissionId: String(raw.submissionId || createId("submission")),
      submissionName: String(raw.submissionName || "Submission"),
      createdAt: String(raw.createdAt || isoNow()),
      overallScore: Number(raw.overallScore || 0),
      scaleMax: Number(raw.scaleMax || assignment.normalizedRubric.totalScaleMax),
      confidence: Number(raw.confidence || 0),
      promptResults: raw.promptResults as GradingResultRecord["promptResults"],
      review: raw.review as GradingResultRecord["review"],
      feedback: raw.feedback as GradingResultRecord["feedback"],
      retrievalSources: Array.isArray(raw.retrievalSources)
        ? (raw.retrievalSources as string[])
        : [],
      sourceAsset: normalizeStoredAsset(raw.sourceAsset as Record<string, unknown>),
    };
  }

  const feedback = (raw.feedback || {}) as Record<string, unknown>;
  const promptResults = [buildLegacyPromptResult(assignment, raw)];

  return {
    schemaVersion: 2,
    submissionId: String(raw.submissionId || createId("submission")),
    submissionName: String(raw.submissionName || "Submission"),
    createdAt: String(raw.createdAt || isoNow()),
    overallScore: Number(raw.overallScore || 0),
    scaleMax: Number(raw.scaleMax || assignment.normalizedRubric.totalScaleMax),
    confidence: Number(raw.confidence || 0),
    promptResults,
    review: {
      needsHumanReview: Boolean((raw.review as Record<string, unknown>)?.needsHumanReview),
      reasons: Array.isArray((raw.review as Record<string, unknown>)?.reasons)
        ? ((raw.review as Record<string, unknown>).reasons as string[])
        : [],
    },
    feedback: {
      teacherSummary: String(feedback.teacherSummary || ""),
      studentFeedback: Array.isArray(feedback.studentFeedback)
        ? (feedback.studentFeedback as string[])
        : [],
    },
    retrievalSources: Array.isArray(raw.retrievalSources)
      ? (raw.retrievalSources as string[])
      : [],
    sourceAsset: normalizeStoredAsset(raw.sourceAsset as Record<string, unknown>),
  };
}

export async function saveAssignment(record: AssignmentRecord) {
  await ensureDataRoot();
  await writeJson(assignmentJsonPath(record.id), record);
}

export async function loadAssignment(assignmentId: string) {
  const raw = await readJson<Record<string, unknown>>(assignmentJsonPath(assignmentId));
  return upgradeAssignmentRecord(raw);
}

export async function saveResult(assignmentId: string, result: GradingResultRecord) {
  await writeJson(path.join(resultsDir(assignmentId), `${result.submissionId}.json`), result);
}

export async function loadResults(assignmentId: string) {
  await fs.mkdir(resultsDir(assignmentId), { recursive: true });
  const assignment = await loadAssignment(assignmentId);
  const fileNames = await fs.readdir(resultsDir(assignmentId));
  const results = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".json"))
      .map(async (fileName) => {
        const raw = await readJson<Record<string, unknown>>(
          path.join(resultsDir(assignmentId), fileName),
        );
        return upgradeResultRecord(raw, assignment);
      }),
  );

  return results.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function loadAssignmentBundle(assignmentId: string): Promise<AssignmentBundle> {
  const assignment = await loadAssignment(assignmentId);
  const results = await loadResults(assignmentId);

  return {
    assignment,
    results,
  };
}

export async function listAssignmentBundles() {
  await ensureDataRoot();
  const entryNames = await fs.readdir(ASSIGNMENTS_ROOT);
  const directoryEntries = await Promise.all(
    entryNames.map(async (entryName) => ({
      entryName,
      stat: await fs.stat(path.join(ASSIGNMENTS_ROOT, entryName)),
    })),
  );
  const bundles = (
    await Promise.all(
      directoryEntries
        .filter((entry) => entry.stat.isDirectory())
        .map(async (entry) => {
          const manifestPath = assignmentJsonPath(entry.entryName);
          if (!existsSync(manifestPath)) {
            return null;
          }

          try {
            return await loadAssignmentBundle(entry.entryName);
          } catch (error) {
            console.warn(
              `Skipping unreadable assignment directory "${entry.entryName}":`,
              error,
            );
            return null;
          }
        }),
    )
  ).filter((bundle): bundle is AssignmentBundle => bundle !== null);

  return bundles.sort((left, right) =>
    right.assignment.updatedAt.localeCompare(left.assignment.updatedAt),
  );
}
