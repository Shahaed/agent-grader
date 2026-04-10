import { NextResponse } from "next/server";

import { gradeSubmissionBatch } from "@/lib/grading-service";
import { loadAssignmentBundle } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const { assignmentId } = await context.params;
    const formData = await request.formData();
    const files = formData
      .getAll("submissionFiles")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    await gradeSubmissionBatch(assignmentId, files);
    const bundle = await loadAssignmentBundle(assignmentId);
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

