import { NextResponse } from "next/server";

import {
  loadGradingBatch,
  loadLatestOpenGradingBatch,
  markGradingBatchFailed,
} from "@/lib/storage";
import { getSessionUser, hasSupabaseServiceRoleKey } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const missingWorkflowConfigError =
  "Server configuration is missing SUPABASE_SERVICE_ROLE_KEY. Add the Supabase secret key to Vercel Production environment variables and redeploy.";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const session = await getSessionUser();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { assignmentId } = await context.params;
    let batch = await loadLatestOpenGradingBatch(assignmentId, session);
    if (
      batch &&
      !hasSupabaseServiceRoleKey() &&
      ["queued", "running"].includes(batch.status)
    ) {
      await markGradingBatchFailed({
        assignmentId,
        batchId: batch.id,
        userId: session.user.id,
        error: missingWorkflowConfigError,
        context: session,
      });
      batch = await loadGradingBatch(assignmentId, batch.id, session);
    }
    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load grading batch.",
      },
      { status: 400 },
    );
  }
}
