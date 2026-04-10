import { NextResponse } from "next/server";

import { createAssignmentFromFormData } from "@/lib/assignment-service";
import { listAssignmentBundles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const assignments = await listAssignmentBundles();
  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const assignment = await createAssignmentFromFormData(formData);

    return NextResponse.json({
      assignmentId: assignment.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create assignment.",
      },
      { status: 400 },
    );
  }
}

