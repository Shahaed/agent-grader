import path from "node:path";

import type {
  AssignmentBundle,
  AssignmentRecord,
  AssetType,
  GradingFeedback,
  GradingResultRecord,
  PromptGradingResult,
  ReviewDecision,
  StoredAsset,
} from "@/lib/types";
import { createId, isoNow, slugify } from "@/lib/utils";
import {
  requireSessionUser,
  type AuthenticatedSupabaseContext,
} from "@/lib/supabase/server";

export const ASSIGNMENT_FILES_BUCKET = "assignment-files";

interface AssignmentRow {
  id: string;
  user_id: string;
  assignment_name: string;
  created_at: string;
  updated_at: string;
  course_profile: AssignmentRecord["courseProfile"];
  assignment_profile: AssignmentRecord["assignmentProfile"];
  level_profile: AssignmentRecord["levelProfile"];
  rubric_text: string;
  normalized_rubric: AssignmentRecord["normalizedRubric"];
  vector_store_id: string | null;
  context_summary: string;
}

interface AssignmentAssetRow {
  id: string;
  assignment_id: string;
  user_id: string;
  asset_type: AssetType;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  openai_file_id: string | null;
  created_at: string;
}

interface GradingResultRow {
  id: string;
  assignment_id: string;
  user_id: string;
  source_asset_id: string;
  submission_name: string;
  created_at: string;
  updated_at: string;
  overall_score: number;
  scale_max: number;
  confidence: number;
  review: ReviewDecision;
  feedback: GradingFeedback;
  prompt_results: PromptGradingResult[];
  retrieval_sources: string[];
}

interface UploadStoredAssetArgs {
  assignmentId: string;
  assetType: AssetType;
  fileName: string;
  bytes: Buffer;
  mimeType: string;
  existingAsset?: StoredAsset;
  assetId?: string;
  context?: AuthenticatedSupabaseContext;
}

function assignmentToRow(
  record: AssignmentRecord,
  userId: string,
): AssignmentRow {
  return {
    id: record.id,
    user_id: userId,
    assignment_name: record.assignmentName,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    course_profile: record.courseProfile,
    assignment_profile: record.assignmentProfile,
    level_profile: record.levelProfile,
    rubric_text: record.rubricText,
    normalized_rubric: record.normalizedRubric,
    vector_store_id: record.vectorStoreId ?? null,
    context_summary: record.contextSummary,
  };
}

function assetToRow(
  assignmentId: string,
  userId: string,
  asset: StoredAsset,
): AssignmentAssetRow {
  return {
    id: asset.id,
    assignment_id: assignmentId,
    user_id: userId,
    asset_type: asset.assetType,
    name: asset.name,
    mime_type: asset.mimeType,
    size_bytes: asset.size,
    storage_bucket: asset.bucket,
    storage_path: asset.storagePath,
    openai_file_id: asset.openAiFileId ?? null,
    created_at: asset.createdAt,
  };
}

function resultToRow(
  assignmentId: string,
  userId: string,
  result: GradingResultRecord,
): GradingResultRow {
  return {
    id: result.submissionId,
    assignment_id: assignmentId,
    user_id: userId,
    source_asset_id: result.sourceAsset.id,
    submission_name: result.submissionName,
    created_at: result.createdAt,
    updated_at: isoNow(),
    overall_score: result.overallScore,
    scale_max: result.scaleMax,
    confidence: result.confidence,
    review: result.review,
    feedback: result.feedback,
    prompt_results: result.promptResults,
    retrieval_sources: result.retrievalSources,
  };
}

function rowToAsset(row: AssignmentAssetRow): StoredAsset {
  return {
    id: row.id,
    assetType: row.asset_type,
    name: row.name,
    mimeType: row.mime_type,
    size: Number(row.size_bytes),
    bucket: row.storage_bucket,
    storagePath: row.storage_path,
    openAiFileId: row.openai_file_id ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToAssignment(
  row: AssignmentRow,
  assets: StoredAsset[],
): AssignmentRecord {
  return {
    schemaVersion: 2,
    id: row.id,
    assignmentName: row.assignment_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    courseProfile: row.course_profile,
    assignmentProfile: row.assignment_profile,
    levelProfile: row.level_profile,
    rubricText: row.rubric_text,
    normalizedRubric: row.normalized_rubric,
    vectorStoreId: row.vector_store_id ?? undefined,
    contextSummary: row.context_summary,
    assets,
  };
}

function rowToResult(
  row: GradingResultRow,
  assetMap: Map<string, StoredAsset>,
): GradingResultRecord {
  const sourceAsset = assetMap.get(row.source_asset_id);

  if (!sourceAsset) {
    throw new Error(
      `Missing source asset ${row.source_asset_id} for result ${row.id}.`,
    );
  }

  return {
    schemaVersion: 2,
    submissionId: row.id,
    submissionName: row.submission_name,
    createdAt: row.created_at,
    overallScore: Number(row.overall_score),
    scaleMax: Number(row.scale_max),
    confidence: Number(row.confidence),
    promptResults: row.prompt_results,
    review: row.review,
    feedback: row.feedback,
    retrievalSources: row.retrieval_sources,
    sourceAsset,
  };
}

async function getContext(context?: AuthenticatedSupabaseContext) {
  return context ?? requireSessionUser();
}

async function loadAssetRows(
  assignmentIds: string[],
  context?: AuthenticatedSupabaseContext,
) {
  if (assignmentIds.length === 0) {
    return [] as AssignmentAssetRow[];
  }

  const { supabase } = await getContext(context);
  const { data, error } = await supabase
    .from("assignment_assets")
    .select("*")
    .in("assignment_id", assignmentIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AssignmentAssetRow[];
}

async function loadResultRows(
  assignmentIds: string[],
  context?: AuthenticatedSupabaseContext,
) {
  if (assignmentIds.length === 0) {
    return [] as GradingResultRow[];
  }

  const { supabase } = await getContext(context);
  const { data, error } = await supabase
    .from("grading_results")
    .select("*")
    .in("assignment_id", assignmentIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GradingResultRow[];
}

function buildStoragePath(
  userId: string,
  assignmentId: string,
  assetType: AssetType,
  fileName: string,
) {
  const extension = path.extname(fileName).toLowerCase();
  const basename =
    slugify(path.basename(fileName, extension)) || assetType || "asset";

  return `${userId}/${assignmentId}/${assetType}/${Date.now()}-${basename}${extension}`;
}

export async function uploadStoredAsset({
  assignmentId,
  assetType,
  fileName,
  bytes,
  mimeType,
  existingAsset,
  assetId,
  context,
}: UploadStoredAssetArgs): Promise<StoredAsset> {
  const resolvedContext = await getContext(context);
  const storagePath =
    existingAsset?.storagePath ??
    buildStoragePath(resolvedContext.user.id, assignmentId, assetType, fileName);

  const { error } = await resolvedContext.supabase.storage
    .from(ASSIGNMENT_FILES_BUCKET)
    .upload(storagePath, new Uint8Array(bytes), {
      contentType: mimeType,
      upsert: Boolean(existingAsset),
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: existingAsset?.id ?? assetId ?? createId("asset"),
    assetType,
    name: fileName,
    mimeType,
    size: bytes.byteLength,
    bucket: ASSIGNMENT_FILES_BUCKET,
    storagePath,
    openAiFileId: existingAsset?.openAiFileId,
    createdAt: existingAsset?.createdAt ?? isoNow(),
  };
}

export async function downloadStoredAsset(
  asset: Pick<StoredAsset, "bucket" | "storagePath">,
  context?: AuthenticatedSupabaseContext,
) {
  const { supabase } = await getContext(context);
  const { data, error } = await supabase.storage
    .from(asset.bucket)
    .download(asset.storagePath);

  if (error) {
    throw new Error(error.message);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function deleteStoredAsset(
  asset: Pick<StoredAsset, "bucket" | "storagePath">,
  context?: AuthenticatedSupabaseContext,
) {
  const { supabase } = await getContext(context);
  const { error } = await supabase.storage
    .from(asset.bucket)
    .remove([asset.storagePath]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function saveAssignment(
  record: AssignmentRecord,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const assignmentRow = assignmentToRow(record, resolvedContext.user.id);

  const { error: assignmentError } = await resolvedContext.supabase
    .from("assignments")
    .upsert(assignmentRow, { onConflict: "id" });

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  if (record.assets.length === 0) {
    return;
  }

  const assetRows = record.assets.map((asset) =>
    assetToRow(record.id, resolvedContext.user.id, asset),
  );
  const { error: assetError } = await resolvedContext.supabase
    .from("assignment_assets")
    .upsert(assetRows, { onConflict: "id" });

  if (assetError) {
    throw new Error(assetError.message);
  }
}

export async function loadAssignment(
  assignmentId: string,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const { data, error } = await resolvedContext.supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Assignment not found.");
  }

  const assetRows = await loadAssetRows([assignmentId], resolvedContext);

  return rowToAssignment(
    data as AssignmentRow,
    assetRows.map(rowToAsset),
  );
}

export async function saveResult(
  assignmentId: string,
  result: GradingResultRecord,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const sourceAssetRow = assetToRow(
    assignmentId,
    resolvedContext.user.id,
    result.sourceAsset,
  );
  const { error: assetError } = await resolvedContext.supabase
    .from("assignment_assets")
    .upsert(sourceAssetRow, { onConflict: "id" });

  if (assetError) {
    throw new Error(assetError.message);
  }

  const { error: resultError } = await resolvedContext.supabase
    .from("grading_results")
    .upsert(resultToRow(assignmentId, resolvedContext.user.id, result), {
      onConflict: "id",
    });

  if (resultError) {
    throw new Error(resultError.message);
  }
}

export async function loadResults(
  assignmentId: string,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const [assetRows, resultRows] = await Promise.all([
    loadAssetRows([assignmentId], resolvedContext),
    loadResultRows([assignmentId], resolvedContext),
  ]);
  const assetMap = new Map(assetRows.map((row) => [row.id, rowToAsset(row)]));

  return resultRows
    .map((row) => rowToResult(row, assetMap))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function loadAssignmentBundle(
  assignmentId: string,
  context?: AuthenticatedSupabaseContext,
): Promise<AssignmentBundle> {
  const resolvedContext = await getContext(context);
  const { data, error } = await resolvedContext.supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Assignment not found.");
  }

  const [assetRows, resultRows] = await Promise.all([
    loadAssetRows([assignmentId], resolvedContext),
    loadResultRows([assignmentId], resolvedContext),
  ]);
  const assets = assetRows.map(rowToAsset);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  return {
    assignment: rowToAssignment(data as AssignmentRow, assets),
    results: resultRows
      .map((row) => rowToResult(row, assetMap))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

export async function listAssignmentBundles(
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const { data, error } = await resolvedContext.supabase
    .from("assignments")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const assignmentRows = (data ?? []) as AssignmentRow[];
  if (assignmentRows.length === 0) {
    return [] as AssignmentBundle[];
  }

  const assignmentIds = assignmentRows.map((row) => row.id);
  const [assetRows, resultRows] = await Promise.all([
    loadAssetRows(assignmentIds, resolvedContext),
    loadResultRows(assignmentIds, resolvedContext),
  ]);

  const assetsByAssignment = new Map<string, StoredAsset[]>();
  for (const row of assetRows) {
    const asset = rowToAsset(row);
    const existing = assetsByAssignment.get(row.assignment_id) ?? [];
    existing.push(asset);
    assetsByAssignment.set(row.assignment_id, existing);
  }

  const resultsByAssignment = new Map<string, GradingResultRecord[]>();
  const globalAssetMap = new Map(assetRows.map((row) => [row.id, rowToAsset(row)]));
  for (const row of resultRows) {
    const existing = resultsByAssignment.get(row.assignment_id) ?? [];
    existing.push(rowToResult(row, globalAssetMap));
    resultsByAssignment.set(row.assignment_id, existing);
  }

  return assignmentRows.map((row) => ({
    assignment: rowToAssignment(row, assetsByAssignment.get(row.id) ?? []),
    results: (resultsByAssignment.get(row.id) ?? []).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
  }));
}
