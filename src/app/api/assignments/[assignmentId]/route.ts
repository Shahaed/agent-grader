import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { updateAssignmentConfig } from "@/lib/assignment-service";
import { loadAssignmentBundle } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { assignmentId } = await context.params;
  const bundle = await loadAssignmentBundle(assignmentId);
  return NextResponse.json(bundle);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { assignmentId } = await context.params;
    const body = (await request.json()) as {
      promptsJson?: string;
      rubricJson?: string;
    };

    if (!body.promptsJson || !body.rubricJson) {
      throw new Error("Missing promptsJson or rubricJson.");
    }

    await updateAssignmentConfig(assignmentId, {
      promptsJson: body.promptsJson,
      rubricJson: body.rubricJson,
    });
    const bundle = await loadAssignmentBundle(assignmentId);
    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update assignment.",
      },
      { status: 400 },
    );
  }
}
