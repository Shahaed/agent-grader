import { NextResponse } from "next/server";

import { loadGradingBatch, markGradingBatchFailed } from "@/lib/storage";
import { getSessionUser, hasSupabaseServiceRoleKey } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const missingWorkflowConfigError =
  "Server configuration is missing SUPABASE_SERVICE_ROLE_KEY. Add the Supabase secret key to Vercel Production environment variables and redeploy.";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignmentId: string; batchId: string }> },
) {
  const session = await getSessionUser();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { assignmentId, batchId } = await context.params;
    let batch = await loadGradingBatch(assignmentId, batchId, session);
    if (
      !hasSupabaseServiceRoleKey() &&
      ["queued", "running"].includes(batch.status)
    ) {
      await markGradingBatchFailed({
        assignmentId,
        batchId,
        userId: session.user.id,
        error: missingWorkflowConfigError,
        context: session,
      });
      batch = await loadGradingBatch(assignmentId, batchId, session);
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
