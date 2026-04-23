import { NextResponse } from "next/server";

import { gradeSubmissionBatch } from "@/lib/grading-service";
import { loadAssignmentBundle } from "@/lib/storage";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

    await gradeSubmissionBatch(assignmentId, files);
    const bundle = await loadAssignmentBundle(assignmentId, session);
    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to grade submissions.",
      },
      { status: 400 },
    );
  }
}
