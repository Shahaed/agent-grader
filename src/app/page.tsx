import { Dashboard } from "@/components/dashboard";
import { listAssignmentBundles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const assignments = await listAssignmentBundles();

  return (
    <Dashboard
      hasOpenAIKey={Boolean(process.env.OPENAI_API_KEY)}
      initialAssignments={assignments}
    />
  );
}
