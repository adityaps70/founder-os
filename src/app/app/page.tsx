import { redirect } from "next/navigation";
import { listMyWorkspaces } from "@/lib/workspace";

/** Entry point after sign-in: go to the first workspace, or create one. */
export default async function AppEntry() {
  const workspaces = await listMyWorkspaces();
  if (workspaces.length === 0) redirect("/onboarding");
  redirect(`/w/${workspaces[0]!.workspace.slug}`);
}
