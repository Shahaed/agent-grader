import { promises as fs } from "node:fs";
import path from "node:path";

import { zodTextFormat } from "openai/helpers/zod";

import { extractTextFromFile } from "@/lib/file-text";
import { getOpenAIClient, models } from "@/lib/openai";
import {
  assignmentAnalysisSchema,
  normalizedRubricSchema,
  promptSetSchema,
} from "@/lib/schemas";
import {
  assignmentAssetDir,
  loadAssignment,
  saveAssignment,
} from "@/lib/storage";
import type {
  AssetType,
  AssignmentPrompt,
  AssignmentRecord,
  AssignmentBundle,
  CourseLevel,
  NormalizedRubric,
  StoredAsset,
} from "@/lib/types";
import {
  cleanText,
  createId,
  inferLevelProfile,
  isoNow,
  parseJson,
  slugify,
  sumRubricScale,
} from "@/lib/utils";

interface SavedLocalFile {
  bytes: Buffer;
  localPath: string;
  name: string;
  mimeType: string;
  size: number;
}

function buildPromptSummary(promptSet: AssignmentPrompt[]) {
  return promptSet
    .sort((left, right) => left.order - right.order)
    .map((prompt, index) =>
      [
        `Prompt ${index + 1}: ${prompt.title}`,
        `Type: ${prompt.type}`,
        `Instructions: ${prompt.instructions}`,
        `Citation expectations: ${prompt.citationExpectations || "Use assignment default"}`,
        `Max score: ${prompt.maxScore ?? "Not specified"}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function ensureRubricPromptReferences(
  promptSet: AssignmentPrompt[],
  rubric: NormalizedRubric,
) {
  const promptIds = new Set(promptSet.map((prompt) => prompt.id));

  rubric.dimensions = rubric.dimensions.map((dimension) => {
    if (dimension.scope === "prompt") {
      const validPromptIds = dimension.promptIds.filter((promptId) =>
        promptIds.has(promptId),
      );

      if (validPromptIds.length === 0) {
        throw new Error(
          `Criterion "${dimension.name}" must reference at least one valid prompt.`,
        );
      }

      return {
        ...dimension,
        promptIds: validPromptIds,
      };
    }

    return {
      ...dimension,
      scope: "global",
      promptIds: [],
    };
  });
}

async function saveLocalFile(
  assignmentId: string,
  assetType: AssetType,
  fileName: string,
  bytes: Buffer,
  mimeType: string,
) {
  const safeName = `${Date.now()}-${slugify(path.basename(fileName, path.extname(fileName))) || "upload"}${path.extname(fileName)}`;
  const localPath = path.join(assignmentAssetDir(assignmentId), assetType, safeName);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, bytes);

  return {
    bytes,
    localPath,
    name: fileName,
    mimeType,
    size: bytes.byteLength,
  } satisfies SavedLocalFile;
}

async function uploadContextFile(
  assignmentId: string,
  vectorStoreId: string,
  assetType: AssetType,
  fileName: string,
  bytes: Buffer,
  mimeType: string,
  level: CourseLevel,
) {
  const client = getOpenAIClient();
  const uploadedFile = await client.files.create({
    file: new File([new Uint8Array(bytes)], fileName, { type: mimeType }),
    purpose: "user_data",
  });

  await client.vectorStores.fileBatches.createAndPoll(vectorStoreId, {
    files: [
      {
        file_id: uploadedFile.id,
        attributes: {
          assignment_id: assignmentId,
          asset_type: assetType,
          course_level: level,
        },
      },
    ],
  });

  return uploadedFile.id;
}

function buildContextSummary(record: Pick<
  AssignmentRecord,
  "assignmentName" | "courseProfile" | "assignmentProfile" | "levelProfile"
>) {
  return [
    `Assignment: ${record.assignmentName}`,
    `Course: ${record.courseProfile.courseName}`,
    `Subject: ${record.courseProfile.subject}`,
    `Level: ${record.courseProfile.level}`,
    `Level profile: ${record.levelProfile}`,
    `Assignment type: ${record.assignmentProfile.assignmentType}`,
    `Assignment citation expectations: ${record.assignmentProfile.citationExpectations || "Not specified"}`,
    `Teacher preferences: ${record.courseProfile.teacherPreferences || "None provided"}`,
    `Prompt set:\n${buildPromptSummary(record.assignmentProfile.promptSet)}`,
  ].join("\n\n");
}

function buildPromptAssetText(record: AssignmentRecord) {
  return [
    record.contextSummary,
    "Prompt set:",
    buildPromptSummary(record.assignmentProfile.promptSet),
  ].join("\n\n");
}

function buildAnchorAssetText(record: AssignmentRecord) {
  return [
    "Assignment anchor for written submission grading.",
    `Rubric ID: ${record.normalizedRubric.rubricId}`,
    `Hard requirements: ${record.normalizedRubric.hardRequirements.join("; ") || "None"}`,
    `Dimensions: ${record.normalizedRubric.dimensions
      .map((dimension) =>
        `${dimension.name} (${dimension.scaleMax}) [${dimension.scope}${dimension.promptIds.length ? `:${dimension.promptIds.join(",")}` : ""}]`,
      )
      .join(", ")}`,
  ].join("\n");
}

async function analyzeAssignmentFromRubric(args: {
  assignmentId: string;
  assignmentName: string;
  courseName: string;
  level: CourseLevel;
  subject: string;
  assignmentType: string;
  rubricText: string;
}) {
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: models.rubric,
    store: false,
    instructions: [
      "You normalize grading rubrics for a written-submission grading app.",
      "Infer the assignment prompt set from the rubric and assignment metadata.",
      "Assignment type is only Essay or Short Answers.",
      "If assignment type is Essay, return exactly one essay prompt.",
      "If assignment type is Short Answers, infer one or more short_answer prompts from the rubric, examples, or described parts.",
      "Return only rubric criteria that are explicitly supported by the uploaded rubric.",
      "Preserve the rubric as the primary scoring authority.",
      "Infer a reasonable total scale only when the rubric implies it.",
      "Weights must sum to 1 when grading_mode is analytic.",
      "Do not add hidden criteria.",
      "For each criterion set scope to global when it applies across the full submission, otherwise use prompt and include the promptIds it applies to.",
      "If the rubric does not clearly separate short-answer parts, return one short_answer prompt.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Assignment ID: ${args.assignmentId}`,
              `Assignment name: ${args.assignmentName}`,
              `Course: ${args.courseName}`,
              `Level: ${args.level}`,
              `Subject: ${args.subject}`,
              `Assignment type: ${args.assignmentType}`,
              `Rubric text:\n${args.rubricText}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(assignmentAnalysisSchema, "assignment_analysis"),
    },
  });

  const analyzed = response.output_parsed;
  if (!analyzed) {
    throw new Error("The model did not return an assignment analysis.");
  }

  const promptSet = promptSetSchema.parse(
    analyzed.promptSet
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((prompt, index) => ({
        ...prompt,
        type: args.assignmentType === "Essay" ? "essay" : "short_answer",
        order: index,
        citationExpectations: prompt.citationExpectations ?? null,
        maxScore: prompt.maxScore ?? null,
      })),
  );
  const normalized = normalizedRubricSchema.parse(analyzed.normalizedRubric);
  ensureRubricPromptReferences(promptSet, normalized);

  const weightSum = normalized.dimensions.reduce(
    (total, dimension) => total + dimension.weight,
    0,
  );

  if (normalized.gradingMode === "analytic" && Math.abs(weightSum - 1) > 0.05) {
    const evenWeight = Number((1 / normalized.dimensions.length).toFixed(4));
    normalized.dimensions = normalized.dimensions.map((dimension, index, dimensions) => ({
      ...dimension,
      weight:
        index === dimensions.length - 1
          ? Number((1 - evenWeight * (dimensions.length - 1)).toFixed(4))
          : evenWeight,
    }));
  }

  if (!normalized.totalScaleMax) {
    normalized.totalScaleMax = sumRubricScale(normalized);
  }

  return {
    promptSet,
    normalizedRubric: normalized,
  };
}

function findAsset(
  record: AssignmentRecord,
  assetType: "prompt" | "anchor",
) {
  return record.assets.find((asset) => asset.assetType === assetType);
}

async function writeGeneratedAsset(
  record: AssignmentRecord,
  assetType: "prompt" | "anchor",
  fileName: string,
  body: string,
) {
  const bytes = Buffer.from(body, "utf8");
  const existingAsset = findAsset(record, assetType);

  if (existingAsset) {
    await fs.mkdir(path.dirname(existingAsset.localPath), { recursive: true });
    await fs.writeFile(existingAsset.localPath, bytes);
    existingAsset.name = fileName;
    existingAsset.mimeType = "text/plain";
    existingAsset.size = bytes.byteLength;
    return {
      asset: existingAsset,
      bytes,
    };
  }

  const saved = await saveLocalFile(
    record.id,
    assetType,
    fileName,
    bytes,
    "text/plain",
  );

  const asset: StoredAsset = {
    id: createId("asset"),
    assetType,
    name: saved.name,
    mimeType: "text/plain",
    size: saved.size,
    localPath: saved.localPath,
    createdAt: isoNow(),
  };
  record.assets.push(asset);
  return {
    asset,
    bytes,
  };
}

async function rebuildVectorStore(record: AssignmentRecord) {
  const client = getOpenAIClient();
  const previousVectorStoreId = record.vectorStoreId;
  const vectorStore = await client.vectorStores.create({
    name: `${record.id}-context`,
  });

  const promptAsset = await writeGeneratedAsset(
    record,
    "prompt",
    `${record.id}-prompt.txt`,
    buildPromptAssetText(record),
  );
  promptAsset.asset.openAiFileId = await uploadContextFile(
    record.id,
    vectorStore.id,
    "prompt",
    promptAsset.asset.name,
    promptAsset.bytes,
    promptAsset.asset.mimeType,
    record.courseProfile.level,
  );

  const anchorAsset = await writeGeneratedAsset(
    record,
    "anchor",
    `${record.id}-anchor.txt`,
    buildAnchorAssetText(record),
  );
  anchorAsset.asset.openAiFileId = await uploadContextFile(
    record.id,
    vectorStore.id,
    "anchor",
    anchorAsset.asset.name,
    anchorAsset.bytes,
    anchorAsset.asset.mimeType,
    record.courseProfile.level,
  );

  for (const asset of record.assets.filter((entry) => entry.assetType === "reading")) {
    const bytes = await fs.readFile(asset.localPath);
    asset.openAiFileId = await uploadContextFile(
      record.id,
      vectorStore.id,
      "reading",
      asset.name,
      bytes,
      asset.mimeType,
      record.courseProfile.level,
    );
  }

  record.vectorStoreId = vectorStore.id;

  if (previousVectorStoreId) {
    try {
      await client.vectorStores.delete(previousVectorStoreId);
    } catch {
      // Best effort cleanup only.
    }
  }
}

function parsePromptSetJson(raw: string) {
  const parsed = promptSetSchema.parse(parseJson<unknown>(raw));
  return parsed
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((prompt, index) => ({
      ...prompt,
      order: index,
      citationExpectations: prompt.citationExpectations ?? null,
      maxScore: prompt.maxScore ?? null,
    }));
}

export async function createAssignmentFromFormData(formData: FormData) {
  const assignmentId = createId("assignment");
  let vectorStoreId: string | undefined;

  try {
    const assignmentName = cleanText(String(formData.get("assignmentName") || ""));
    const courseName = cleanText(String(formData.get("courseName") || ""));
    const level = String(formData.get("level") || "high_school") as CourseLevel;
    const subject = cleanText(String(formData.get("subject") || ""));
    const assignmentType = cleanText(String(formData.get("assignmentType") || ""));
    const rubricFile = formData.get("rubricFile");

    if (!assignmentName || !courseName || !subject || !assignmentType) {
      throw new Error("Assignment name, course, subject, and assignment type are required.");
    }

    if (!(rubricFile instanceof File) || rubricFile.size === 0) {
      throw new Error("A rubric file is required.");
    }

    const createdAt = isoNow();
    const rubricBytes = Buffer.from(await rubricFile.arrayBuffer());
    const savedRubric = await saveLocalFile(
      assignmentId,
      "rubric",
      rubricFile.name,
      rubricBytes,
      rubricFile.type || "application/octet-stream",
    );
    const rubricText = await extractTextFromFile(rubricFile);
    const levelProfile = inferLevelProfile(level, assignmentType, rubricText);

    const analysis = await analyzeAssignmentFromRubric({
      assignmentId,
      assignmentName,
      courseName,
      level,
      subject,
      assignmentType,
      rubricText,
    });

    const record: AssignmentRecord = {
      schemaVersion: 2,
      id: assignmentId,
      assignmentName,
      createdAt,
      updatedAt: createdAt,
      courseProfile: {
        courseName,
        level,
        subject,
        teacherPreferences: "",
      },
      assignmentProfile: {
        assignmentType,
        citationExpectations: "",
        promptSet: analysis.promptSet,
      },
      levelProfile,
      rubricText,
      normalizedRubric: analysis.normalizedRubric,
      contextSummary: "",
      assets: [
        {
          id: createId("asset"),
          assetType: "rubric",
          name: rubricFile.name,
          mimeType: savedRubric.mimeType,
          size: savedRubric.size,
          localPath: savedRubric.localPath,
          createdAt,
        },
      ],
    };

    record.contextSummary = buildContextSummary(record);

    const readingEntries = formData.getAll("readingFiles");
    for (const entry of readingEntries) {
      if (!(entry instanceof File) || entry.size === 0) {
        continue;
      }

      const bytes = Buffer.from(await entry.arrayBuffer());
      const savedReading = await saveLocalFile(
        assignmentId,
        "reading",
        entry.name,
        bytes,
        entry.type || "application/octet-stream",
      );

      record.assets.push({
        id: createId("asset"),
        assetType: "reading",
        name: entry.name,
        mimeType: savedReading.mimeType,
        size: savedReading.size,
        localPath: savedReading.localPath,
        createdAt,
      });
    }

    await rebuildVectorStore(record);
    vectorStoreId = record.vectorStoreId;
    await saveAssignment(record);

    return record;
  } catch (error) {
    await fs.rm(path.dirname(assignmentAssetDir(assignmentId)), {
      recursive: true,
      force: true,
    });

    if (vectorStoreId) {
      try {
        await getOpenAIClient().vectorStores.delete(vectorStoreId);
      } catch {
        // Best effort cleanup only.
      }
    }

    throw error;
  }
}

export async function updateAssignmentConfig(
  assignmentId: string,
  args: { promptsJson: string; rubricJson: string },
) {
  const record = await loadAssignment(assignmentId);
  const promptSet = parsePromptSetJson(args.promptsJson);
  const rubric = normalizedRubricSchema.parse(parseJson(args.rubricJson));
  ensureRubricPromptReferences(promptSet, rubric);
  rubric.totalScaleMax ||= sumRubricScale(rubric);

  record.assignmentProfile.promptSet = promptSet;
  record.normalizedRubric = rubric;
  record.contextSummary = buildContextSummary(record);
  record.updatedAt = isoNow();

  await rebuildVectorStore(record);
  await saveAssignment(record);

  return record;
}

export async function hydrateAssignmentBundle(record: AssignmentRecord): Promise<AssignmentBundle> {
  return {
    assignment: record,
    results: [],
  };
}
