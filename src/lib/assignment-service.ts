import { promises as fs } from "node:fs";
import path from "node:path";

import { zodTextFormat } from "openai/helpers/zod";

import { extractTextFromFile } from "@/lib/file-text";
import { models, getOpenAIClient } from "@/lib/openai";
import { normalizedRubricSchema } from "@/lib/schemas";
import {
  assignmentAssetDir,
  loadAssignment,
  saveAssignment,
} from "@/lib/storage";
import type {
  AssetType,
  AssignmentRecord,
  AssignmentBundle,
  CourseLevel,
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
  "courseProfile" | "assignmentProfile" | "levelProfile"
>) {
  return [
    `Course: ${record.courseProfile.courseName}`,
    `Subject: ${record.courseProfile.subject}`,
    `Level: ${record.courseProfile.level}`,
    `Level profile: ${record.levelProfile}`,
    `Assignment type: ${record.assignmentProfile.assignmentType}`,
    `Citation expectations: ${record.assignmentProfile.citationExpectations || "Not specified"}`,
    `Teacher preferences: ${record.courseProfile.teacherPreferences || "None provided"}`,
  ].join("\n");
}

async function normalizeRubric(args: {
  assignmentId: string;
  courseName: string;
  level: CourseLevel;
  subject: string;
  assignmentType: string;
  essayPrompt: string;
  rubricText: string;
}) {
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: models.rubric,
    store: false,
    instructions: [
      "You normalize grading rubrics for an essay-grading app.",
      "Return only rubric criteria that are explicitly supported by the uploaded rubric.",
      "Preserve the rubric as the primary scoring authority.",
      "Infer a reasonable total scale only when the rubric implies it.",
      "Weights must sum to 1 when grading_mode is analytic.",
      "Do not add hidden criteria.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Assignment ID: ${args.assignmentId}`,
              `Course: ${args.courseName}`,
              `Level: ${args.level}`,
              `Subject: ${args.subject}`,
              `Assignment type: ${args.assignmentType}`,
              `Essay prompt:\n${args.essayPrompt}`,
              `Rubric text:\n${args.rubricText}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(normalizedRubricSchema, "normalized_rubric"),
    },
  });

  const normalized = response.output_parsed;
  if (!normalized) {
    throw new Error("The model did not return a normalized rubric.");
  }

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

  return normalized;
}

export async function createAssignmentFromFormData(formData: FormData) {
  const assignmentId = createId("assignment");
  let vectorStoreId: string | undefined;

  try {
    const courseName = cleanText(String(formData.get("courseName") || ""));
    const level = String(formData.get("level") || "high_school") as CourseLevel;
    const subject = cleanText(String(formData.get("subject") || ""));
    const teacherPreferences = cleanText(String(formData.get("teacherPreferences") || ""));
    const essayPrompt = cleanText(String(formData.get("essayPrompt") || ""));
    const assignmentType = cleanText(String(formData.get("assignmentType") || ""));
    const citationExpectations = cleanText(
      String(formData.get("citationExpectations") || ""),
    );
    const rubricFile = formData.get("rubricFile");

    if (!courseName || !subject || !essayPrompt || !assignmentType) {
      throw new Error("Course, subject, assignment type, and essay prompt are required.");
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

    const normalizedRubric = await normalizeRubric({
      assignmentId,
      courseName,
      level,
      subject,
      assignmentType,
      essayPrompt,
      rubricText,
    });

    const vectorStore = await getOpenAIClient().vectorStores.create({
      name: `${assignmentId}-context`,
    });
    vectorStoreId = vectorStore.id;

    const record: AssignmentRecord = {
      id: assignmentId,
      createdAt,
      updatedAt: createdAt,
      courseProfile: {
        courseName,
        level,
        subject,
        teacherPreferences,
      },
      assignmentProfile: {
        essayPrompt,
        assignmentType,
        citationExpectations,
      },
      levelProfile,
      rubricText,
      normalizedRubric,
      vectorStoreId: vectorStore.id,
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

    const promptFileText = [
      record.contextSummary,
      `Essay prompt:\n${record.assignmentProfile.essayPrompt}`,
    ].join("\n\n");
    const promptFileName = `${assignmentId}-prompt.txt`;
    const promptFileBytes = Buffer.from(promptFileText, "utf8");
    const savedPrompt = await saveLocalFile(
      assignmentId,
      "prompt",
      promptFileName,
      promptFileBytes,
      "text/plain",
    );
    const promptOpenAiFileId = await uploadContextFile(
      assignmentId,
      vectorStore.id,
      "prompt",
      promptFileName,
      promptFileBytes,
      "text/plain",
      level,
    );

    record.assets.push({
      id: createId("asset"),
      assetType: "prompt",
      name: promptFileName,
      mimeType: "text/plain",
      size: savedPrompt.size,
      localPath: savedPrompt.localPath,
      openAiFileId: promptOpenAiFileId,
      createdAt,
    });

    const anchorText = [
      "Assignment anchor for essay grading.",
      `Rubric ID: ${record.normalizedRubric.rubricId}`,
      `Hard requirements: ${record.normalizedRubric.hardRequirements.join("; ") || "None"}`,
      `Dimensions: ${record.normalizedRubric.dimensions
        .map((dimension) => `${dimension.name} (${dimension.scaleMax})`)
        .join(", ")}`,
    ].join("\n");
    const anchorFileName = `${assignmentId}-anchor.txt`;
    const anchorFileBytes = Buffer.from(anchorText, "utf8");
    const savedAnchor = await saveLocalFile(
      assignmentId,
      "anchor",
      anchorFileName,
      anchorFileBytes,
      "text/plain",
    );
    const anchorOpenAiFileId = await uploadContextFile(
      assignmentId,
      vectorStore.id,
      "anchor",
      anchorFileName,
      anchorFileBytes,
      "text/plain",
      level,
    );

    record.assets.push({
      id: createId("asset"),
      assetType: "anchor",
      name: anchorFileName,
      mimeType: "text/plain",
      size: savedAnchor.size,
      localPath: savedAnchor.localPath,
      openAiFileId: anchorOpenAiFileId,
      createdAt,
    });

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
      const openAiFileId = await uploadContextFile(
        assignmentId,
        vectorStore.id,
        "reading",
        entry.name,
        bytes,
        entry.type || "application/octet-stream",
        level,
      );

      record.assets.push({
        id: createId("asset"),
        assetType: "reading",
        name: entry.name,
        mimeType: savedReading.mimeType,
        size: savedReading.size,
        localPath: savedReading.localPath,
        openAiFileId,
        createdAt,
      });
    }

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

export async function updateAssignmentRubric(assignmentId: string, rubricJson: string) {
  const record = await loadAssignment(assignmentId);
  record.normalizedRubric = normalizedRubricSchema.parse(parseJson(rubricJson));
  record.normalizedRubric.totalScaleMax ||= sumRubricScale(record.normalizedRubric);
  record.updatedAt = isoNow();
  await saveAssignment(record);

  return record;
}

export async function hydrateAssignmentBundle(record: AssignmentRecord): Promise<AssignmentBundle> {
  return {
    assignment: record,
    results: [],
  };
}
