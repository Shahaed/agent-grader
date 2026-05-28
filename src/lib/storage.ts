import path from "node:path";

import type {
  AssignmentBundle,
  AssignmentRecord,
  AssetType,
  GradingBatchRecord,
  GradingBatchStatus,
  GradingFeedback,
  GradingJobRecord,
  GradingJobStatus,
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

interface GradingBatchRow {
  id: string;
  assignment_id: string;
  user_id: string;
  workflow_run_id: string | null;
  status: GradingBatchStatus;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  cancelled_jobs: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface GradingJobRow {
  id: string;
  batch_id: string;
  assignment_id: string;
  user_id: string;
  source_asset_id: string;
  submission_name: string;
  status: GradingJobStatus;
  progress_label: string;
  current_step: number;
  total_steps: number;
  error_message: string | null;
  retry_count: number;
  result_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  cleared_at: string | null;
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

function rowToJob(
  row: GradingJobRow,
  assetMap: Map<string, StoredAsset>,
): GradingJobRecord {
  const sourceAsset = assetMap.get(row.source_asset_id);

  if (!sourceAsset) {
    throw new Error(`Missing source asset ${row.source_asset_id} for job ${row.id}.`);
  }

  return {
    id: row.id,
    batchId: row.batch_id,
    assignmentId: row.assignment_id,
    sourceAsset,
    submissionName: row.submission_name,
    status: row.status,
    progressLabel: row.progress_label,
    currentStep: Number(row.current_step),
    totalSteps: Number(row.total_steps),
    error: row.error_message,
    retryCount: Number(row.retry_count),
    resultId: row.result_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function rowToBatch(
  row: GradingBatchRow,
  jobs: GradingJobRecord[],
): GradingBatchRecord {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    workflowRunId: row.workflow_run_id,
    status: row.status,
    totalJobs: Number(row.total_jobs),
    completedJobs: Number(row.completed_jobs),
    failedJobs: Number(row.failed_jobs),
    cancelledJobs: Number(row.cancelled_jobs),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    jobs,
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

export async function saveAssignmentAsset(
  assignmentId: string,
  asset: StoredAsset,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const { error } = await resolvedContext.supabase
    .from("assignment_assets")
    .upsert(assetToRow(assignmentId, resolvedContext.user.id, asset), {
      onConflict: "id",
    });

  if (error) {
    throw new Error(error.message);
  }
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

export async function createGradingBatch(args: {
  assignmentId: string;
  assets: StoredAsset[];
  totalSteps: number;
  context?: AuthenticatedSupabaseContext;
}) {
  if (args.assets.length === 0) {
    throw new Error("Upload at least one student submission.");
  }

  const resolvedContext = await getContext(args.context);
  const now = isoNow();
  const batchId = createId("batch");
  const batchRow: GradingBatchRow = {
    id: batchId,
    assignment_id: args.assignmentId,
    user_id: resolvedContext.user.id,
    workflow_run_id: null,
    status: "queued",
    total_jobs: args.assets.length,
    completed_jobs: 0,
    failed_jobs: 0,
    cancelled_jobs: 0,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  const jobRows: GradingJobRow[] = args.assets.map((asset) => ({
    id: createId("submission"),
    batch_id: batchId,
    assignment_id: args.assignmentId,
    user_id: resolvedContext.user.id,
    source_asset_id: asset.id,
    submission_name: asset.name,
    status: "queued",
    progress_label: "Queued",
    current_step: 0,
    total_steps: args.totalSteps,
    error_message: null,
    retry_count: 0,
    result_id: null,
    created_at: now,
    updated_at: now,
    started_at: null,
    completed_at: null,
    cleared_at: null,
  }));

  const { error: batchError } = await resolvedContext.supabase
    .from("grading_batches")
    .insert(batchRow);

  if (batchError) {
    throw new Error(batchError.message);
  }

  const { error: jobsError } = await resolvedContext.supabase
    .from("grading_jobs")
    .insert(jobRows);

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const assetMap = new Map(args.assets.map((asset) => [asset.id, asset]));
  return rowToBatch(
    batchRow,
    jobRows.map((row) => rowToJob(row, assetMap)),
  );
}

export async function updateGradingBatchRun(
  assignmentId: string,
  batchId: string,
  workflowRunId: string,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const { error } = await resolvedContext.supabase
    .from("grading_batches")
    .update({
      workflow_run_id: workflowRunId,
      status: "running",
      updated_at: isoNow(),
    })
    .eq("id", batchId)
    .eq("assignment_id", assignmentId);

  if (error) {
    throw new Error(error.message);
  }
}

async function loadJobsForBatch(
  assignmentId: string,
  batchId: string,
  includeCleared: boolean,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  let query = resolvedContext.supabase
    .from("grading_jobs")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });

  if (!includeCleared) {
    query = query.is("cleared_at", null);
  }

  const { data: jobRows, error: jobsError } = await query;

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const rows = (jobRows ?? []) as GradingJobRow[];
  const assetIds = rows.map((row) => row.source_asset_id);
  const assetRows = assetIds.length
    ? await loadAssetRows([assignmentId], resolvedContext)
    : [];
  const assetMap = new Map(
    assetRows.map((row) => {
      const asset = rowToAsset(row);
      return [asset.id, asset] as const;
    }),
  );

  return rows.map((row) => rowToJob(row, assetMap));
}

export async function loadGradingBatch(
  assignmentId: string,
  batchId: string,
  context?: AuthenticatedSupabaseContext,
  options: { includeCleared?: boolean } = {},
) {
  const resolvedContext = await getContext(context);
  const { data, error } = await resolvedContext.supabase
    .from("grading_batches")
    .select("*")
    .eq("id", batchId)
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Grading batch not found.");
  }

  const jobs = await loadJobsForBatch(
    assignmentId,
    batchId,
    Boolean(options.includeCleared),
    resolvedContext,
  );

  return rowToBatch(data as GradingBatchRow, jobs);
}

export async function loadLatestOpenGradingBatch(
  assignmentId: string,
  context?: AuthenticatedSupabaseContext,
) {
  const resolvedContext = await getContext(context);
  const { data, error } = await resolvedContext.supabase
    .from("grading_batches")
    .select("*")
    .eq("assignment_id", assignmentId)
    .in("status", ["queued", "running", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const batch = data as GradingBatchRow;
  const jobs = await loadJobsForBatch(
    assignmentId,
    batch.id,
    false,
    resolvedContext,
  );

  return rowToBatch(batch, jobs);
}

export async function listRunnableGradingJobs(args: {
  assignmentId: string;
  batchId: string;
  userId: string;
  context: AuthenticatedSupabaseContext;
}) {
  const { data, error } = await args.context.supabase
    .from("grading_jobs")
    .select("id")
    .eq("assignment_id", args.assignmentId)
    .eq("batch_id", args.batchId)
    .eq("user_id", args.userId)
    .eq("status", "queued")
    .is("cleared_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.id as string);
}

export async function loadGradingJob(args: {
  assignmentId: string;
  batchId: string;
  jobId: string;
  userId: string;
  context: AuthenticatedSupabaseContext;
}) {
  const { data, error } = await args.context.supabase
    .from("grading_jobs")
    .select("*")
    .eq("id", args.jobId)
    .eq("batch_id", args.batchId)
    .eq("assignment_id", args.assignmentId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Grading job not found.");
  }

  const row = data as GradingJobRow;
  const assetRows = await loadAssetRows([args.assignmentId], args.context);
  const assetMap = new Map(
    assetRows.map((assetRow) => {
      const asset = rowToAsset(assetRow);
      return [asset.id, asset] as const;
    }),
  );

  return rowToJob(row, assetMap);
}

export async function updateGradingJobProgress(args: {
  assignmentId: string;
  batchId: string;
  jobId: string;
  userId: string;
  progressLabel: string;
  currentStep: number;
  context: AuthenticatedSupabaseContext;
}) {
  const { error } = await args.context.supabase
    .from("grading_jobs")
    .update({
      status: "running",
      progress_label: args.progressLabel,
      current_step: args.currentStep,
      error_message: null,
      started_at: isoNow(),
      updated_at: isoNow(),
    })
    .eq("id", args.jobId)
    .eq("batch_id", args.batchId)
    .eq("assignment_id", args.assignmentId)
    .eq("user_id", args.userId)
    .neq("status", "cancelled");

  if (error) {
    throw new Error(error.message);
  }
}

export async function markGradingJobCompleted(args: {
  assignmentId: string;
  batchId: string;
  jobId: string;
  userId: string;
  context: AuthenticatedSupabaseContext;
}) {
  const now = isoNow();
  const { error } = await args.context.supabase
    .from("grading_jobs")
    .update({
      status: "completed",
      progress_label: "Saved",
      current_step: 999,
      error_message: null,
      result_id: args.jobId,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", args.jobId)
    .eq("batch_id", args.batchId)
    .eq("assignment_id", args.assignmentId)
    .eq("user_id", args.userId)
    .neq("status", "cancelled");

  if (error) {
    throw new Error(error.message);
  }
}

export async function markGradingJobFailed(args: {
  assignmentId: string;
  batchId: string;
  jobId: string;
  userId: string;
  error: string;
  context: AuthenticatedSupabaseContext;
}) {
  const now = isoNow();
  const { error } = await args.context.supabase
    .from("grading_jobs")
    .update({
      status: "failed",
      progress_label: "Failed",
      error_message: args.error,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", args.jobId)
    .eq("batch_id", args.batchId)
    .eq("assignment_id", args.assignmentId)
    .eq("user_id", args.userId)
    .neq("status", "cancelled");

  if (error) {
    throw new Error(error.message);
  }
}

export async function markGradingBatchFailed(args: {
  assignmentId: string;
  batchId: string;
  userId: string;
  error: string;
  context: AuthenticatedSupabaseContext;
}) {
  const now = isoNow();
  const { error } = await args.context.supabase
    .from("grading_jobs")
    .update({
      status: "failed",
      progress_label: "Setup failed",
      error_message: args.error,
      completed_at: now,
      updated_at: now,
    })
    .eq("assignment_id", args.assignmentId)
    .eq("batch_id", args.batchId)
    .eq("user_id", args.userId)
    .in("status", ["queued", "running", "failed"]);

  if (error) {
    throw new Error(error.message);
  }

  await refreshGradingBatchSummary({
    assignmentId: args.assignmentId,
    batchId: args.batchId,
    userId: args.userId,
    context: args.context,
  });
}

export async function refreshGradingBatchSummary(args: {
  assignmentId: string;
  batchId: string;
  userId: string;
  context: AuthenticatedSupabaseContext;
}) {
  const { data, error } = await args.context.supabase
    .from("grading_jobs")
    .select("status")
    .eq("assignment_id", args.assignmentId)
    .eq("batch_id", args.batchId)
    .eq("user_id", args.userId);

  if (error) {
    throw new Error(error.message);
  }

  const statuses = (data ?? []).map((row) => row.status as GradingJobStatus);
  const completedJobs = statuses.filter((status) => status === "completed").length;
  const failedJobs = statuses.filter((status) => status === "failed").length;
  const cancelledJobs = statuses.filter((status) => status === "cancelled").length;
  const runningJobs = statuses.filter((status) => status === "running").length;
  const queuedJobs = statuses.filter((status) => status === "queued").length;
  const terminalJobs = completedJobs + failedJobs + cancelledJobs;
  const now = isoNow();
  const status: GradingBatchStatus =
    statuses.length > 0 && terminalJobs === statuses.length
      ? failedJobs > 0
        ? "failed"
        : cancelledJobs > 0
          ? "cancelled"
          : "completed"
      : runningJobs > 0 || queuedJobs > 0
        ? "running"
        : "failed";

  const { error: updateError } = await args.context.supabase
    .from("grading_batches")
    .update({
      status,
      completed_jobs: completedJobs,
      failed_jobs: failedJobs,
      cancelled_jobs: cancelledJobs,
      updated_at: now,
      completed_at:
        status === "completed" || status === "failed" || status === "cancelled"
          ? now
          : null,
    })
    .eq("id", args.batchId)
    .eq("assignment_id", args.assignmentId)
    .eq("user_id", args.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function retryFailedGradingJobs(args: {
  assignmentId: string;
  batchId: string;
  context?: AuthenticatedSupabaseContext;
}) {
  const resolvedContext = await getContext(args.context);
  const { error } = await resolvedContext.supabase
    .from("grading_jobs")
    .update({
      status: "queued",
      progress_label: "Queued for retry",
      current_step: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
      updated_at: isoNow(),
    })
    .eq("assignment_id", args.assignmentId)
    .eq("batch_id", args.batchId)
    .eq("status", "failed")
    .is("cleared_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const { error: retryCountError } = await resolvedContext.supabase.rpc(
    "increment_grading_job_retry_count",
    {
      target_assignment_id: args.assignmentId,
      target_batch_id: args.batchId,
    },
  );

  if (retryCountError) {
    throw new Error(retryCountError.message);
  }
}

export async function cancelOpenGradingJobs(args: {
  assignmentId: string;
  batchId: string;
  context?: AuthenticatedSupabaseContext;
}) {
  const resolvedContext = await getContext(args.context);
  const now = isoNow();
  const { error } = await resolvedContext.supabase
    .from("grading_jobs")
    .update({
      status: "cancelled",
      progress_label: "Cancelled",
      completed_at: now,
      updated_at: now,
    })
    .eq("assignment_id", args.assignmentId)
    .eq("batch_id", args.batchId)
    .in("status", ["queued", "running"]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearCompletedGradingJobs(args: {
  assignmentId: string;
  batchId: string;
  context?: AuthenticatedSupabaseContext;
}) {
  const resolvedContext = await getContext(args.context);
  const { error } = await resolvedContext.supabase
    .from("grading_jobs")
    .update({
      cleared_at: isoNow(),
      updated_at: isoNow(),
    })
    .eq("assignment_id", args.assignmentId)
    .eq("batch_id", args.batchId)
    .eq("status", "completed");

  if (error) {
    throw new Error(error.message);
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
