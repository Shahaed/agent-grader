import { NextResponse } from "next/server";
import { start } from "workflow/api";

import {
  loadGradingBatch,
  refreshGradingBatchSummary,
  retryFailedGradingJobs,
  updateGradingBatchRun,
} from "@/lib/storage";
import { getSessionUser } from "@/lib/supabase/server";
import { gradeSubmissionBatchWorkflow } from "@/workflows/grade-submission-batch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  context: { params: Promise<{ assignmentId: string; batchId: string }> },
) {
  const session = await getSessionUser();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { assignmentId, batchId } = await context.params;
    await retryFailedGradingJobs({ assignmentId, batchId, context: session });
    await refreshGradingBatchSummary({
      assignmentId,
      batchId,
      userId: session.user.id,
      context: session,
    });

    const run = await start(gradeSubmissionBatchWorkflow, [
      {
        assignmentId,
        batchId,
        userId: session.user.id,
      },
    ]);
    await updateGradingBatchRun(assignmentId, batchId, run.runId, session);

    const batch = await loadGradingBatch(assignmentId, batchId, session);
    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to retry grading batch.",
      },
      { status: 400 },
    );
  }
}
