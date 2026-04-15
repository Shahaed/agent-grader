import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { updateResultFeedback } from "@/lib/grading-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string; submissionId: string }> },
) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { assignmentId, submissionId } = await context.params;
    const body = (await request.json()) as {
      feedback?: {
        teacherSummary?: string;
        studentFeedback?: string[];
      };
    };

    if (!body.feedback?.teacherSummary || !body.feedback.studentFeedback?.length) {
      throw new Error("Feedback must include a teacher summary and student feedback.");
    }

    const result = await updateResultFeedback(assignmentId, submissionId, {
      teacherSummary: body.feedback.teacherSummary,
      studentFeedback: body.feedback.studentFeedback,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save feedback.",
      },
      { status: 400 },
    );
  }
}
