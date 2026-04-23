import { NextResponse } from "next/server";

import { createAssignmentFromFormData } from "@/lib/assignment-service";
import { listAssignmentBundles } from "@/lib/storage";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const assignments = await listAssignmentBundles(session);
  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const session = await getSessionUser();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

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
