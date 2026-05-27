import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

import {
  cancelOpenGradingJobs,
  loadGradingBatch,
  refreshGradingBatchSummary,
} from "@/lib/storage";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    const currentBatch = await loadGradingBatch(assignmentId, batchId, session);
    await cancelOpenGradingJobs({ assignmentId, batchId, context: session });
    if (currentBatch.workflowRunId) {
      try {
        await getRun(currentBatch.workflowRunId).cancel();
      } catch {
        // The database cancellation flag is the source of truth for this UI.
      }
    }
    await refreshGradingBatchSummary({
      assignmentId,
      batchId,
      userId: session.user.id,
      context: session,
    });
    const batch = await loadGradingBatch(assignmentId, batchId, session);
    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to cancel grading batch.",
      },
      { status: 400 },
    );
  }
}
