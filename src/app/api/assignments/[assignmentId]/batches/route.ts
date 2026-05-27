import { NextResponse } from "next/server";

import { loadLatestOpenGradingBatch } from "@/lib/storage";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    const batch = await loadLatestOpenGradingBatch(assignmentId, session);
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
