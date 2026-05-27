import { NextResponse } from "next/server";

import { clearCompletedGradingJobs, loadGradingBatch } from "@/lib/storage";
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
    await clearCompletedGradingJobs({ assignmentId, batchId, context: session });
    const batch = await loadGradingBatch(assignmentId, batchId, session);
    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to clear completed jobs.",
      },
      { status: 400 },
    );
  }
}
