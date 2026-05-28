import { NextResponse } from "next/server";
import { start } from "workflow/api";

import {
  createGradingBatch,
  loadAssignment,
  loadGradingBatch,
  markGradingBatchFailed,
  saveAssignmentAsset,
  updateGradingBatchRun,
  uploadStoredAsset,
} from "@/lib/storage";
import { getSessionUser, hasSupabaseServiceRoleKey } from "@/lib/supabase/server";
import { gradeSubmissionBatchWorkflow } from "@/workflows/grade-submission-batch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const missingWorkflowConfigError =
  "Server configuration is missing SUPABASE_SERVICE_ROLE_KEY. Add the Supabase secret key to Vercel Production environment variables and redeploy.";

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const session = await getSessionUser();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { assignmentId } = await context.params;
    const formData = await request.formData();
    const files = formData
      .getAll("submissionFiles")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one student submission." },
        { status: 400 },
      );
    }

    const assignment = await loadAssignment(assignmentId, session);
    const assets = [];

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const asset = await uploadStoredAsset({
        assignmentId,
        assetType: "submission",
        fileName: file.name,
        bytes,
        mimeType: file.type || "application/octet-stream",
        context: session,
      });
      await saveAssignmentAsset(assignmentId, asset, session);
      assets.push(asset);
    }

    const totalSteps = assignment.assignmentProfile.promptSet.length + 4;
    const batch = await createGradingBatch({
      assignmentId,
      assets,
      totalSteps,
      context: session,
    });

    if (!hasSupabaseServiceRoleKey()) {
      await markGradingBatchFailed({
        assignmentId,
        batchId: batch.id,
        userId: session.user.id,
        error: missingWorkflowConfigError,
        context: session,
      });
      const failedBatch = await loadGradingBatch(assignmentId, batch.id, session);
      return NextResponse.json({ batch: failedBatch });
    }

    let run;
    try {
      run = await start(gradeSubmissionBatchWorkflow, [
        {
          assignmentId,
          batchId: batch.id,
          userId: session.user.id,
        },
      ]);
    } catch (workflowError) {
      await markGradingBatchFailed({
        assignmentId,
        batchId: batch.id,
        userId: session.user.id,
        error:
          workflowError instanceof Error
            ? workflowError.message
            : "Failed to start grading workflow.",
        context: session,
      });
      const failedBatch = await loadGradingBatch(assignmentId, batch.id, session);
      return NextResponse.json({ batch: failedBatch });
    }

    await updateGradingBatchRun(assignmentId, batch.id, run.runId, session);
    const queuedBatch = await loadGradingBatch(assignmentId, batch.id, session);
    return NextResponse.json({ batch: queuedBatch });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to grade submissions.",
      },
      { status: 400 },
    );
  }
}
