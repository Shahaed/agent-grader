import { auth } from "@clerk/nextjs/server";

import { AssignmentDashboard } from "@/components/assignment-dashboard";
import { listAssignmentBundles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const { isAuthenticated, redirectToSignIn } = await auth();

  if (!isAuthenticated) {
    return redirectToSignIn();
  }

  const assignments = await listAssignmentBundles();

  return (
    <AssignmentDashboard
      hasOpenAIKey={Boolean(process.env.OPENAI_API_KEY)}
      initialAssignments={assignments}
    />
  );
}
