import { WorkspaceApp } from "@/components/workspace/app";
import { getMockAuthSessionsByRole } from "@/lib/auth/session-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authSessions = await getMockAuthSessionsByRole();

  return <WorkspaceApp authSessions={authSessions} />;
}
