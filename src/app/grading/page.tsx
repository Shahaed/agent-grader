import { auth } from "@clerk/nextjs/server";

import { GradingDashboard } from "@/components/grading-dashboard";
import { listAssignmentBundles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function GradingPage() {
  const { isAuthenticated, redirectToSignIn } = await auth();

  if (!isAuthenticated) {
    return redirectToSignIn();
  }

  const assignments = await listAssignmentBundles();

  return (
    <GradingDashboard
      hasOpenAIKey={Boolean(process.env.OPENAI_API_KEY)}
      initialAssignments={assignments}
    />
  );
}
