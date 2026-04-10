import { NextResponse } from "next/server";

import { updateAssignmentRubric } from "@/lib/assignment-service";
import { loadAssignmentBundle } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await context.params;
  const bundle = await loadAssignmentBundle(assignmentId);
  return NextResponse.json(bundle);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const { assignmentId } = await context.params;
    const body = (await request.json()) as { rubricJson?: string };

    if (!body.rubricJson) {
      throw new Error("Missing rubricJson.");
    }

    await updateAssignmentRubric(assignmentId, body.rubricJson);
    const bundle = await loadAssignmentBundle(assignmentId);
    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update rubric.",
      },
      { status: 400 },
    );
  }
}

