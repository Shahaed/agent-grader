import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { runCalibrationPass } from "@/lib/grading-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { assignmentId } = await context.params;
    const calibration = await runCalibrationPass(assignmentId);
    return NextResponse.json({ calibration });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run calibration.",
      },
      { status: 400 },
    );
  }
}
