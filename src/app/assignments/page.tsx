import { redirect } from "next/navigation";

import { AssignmentDashboard } from "@/components/assignment-dashboard";
import { listAssignmentBundles } from "@/lib/storage";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const session = await getSessionUser();

  if (!session?.user) {
    redirect("/login");
  }

  const assignments = await listAssignmentBundles(session);

  return (
    <AssignmentDashboard
      currentUserEmail={session.user.email ?? "Signed in"}
      hasOpenAIKey={Boolean(process.env.OPENAI_API_KEY)}
      initialAssignments={assignments}
    />
  );
}
