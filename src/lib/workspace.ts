import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, TeamMember, Workspace } from "@/lib/types";

/** The signed-in user, or a redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

/** All workspaces the user belongs to (for the switcher). */
export const listMyWorkspaces = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at");
  return (data ?? [])
    .map((r) => ({ role: r.role as Role, workspace: r.workspaces as unknown as Workspace }))
    .filter((r) => r.workspace);
});

export interface WorkspaceContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  workspace: Workspace;
  role: Role;
  /** The signed-in user's own entry in the team (used for "me" / delegation). */
  me: TeamMember | null;
  team: TeamMember[];
}

/**
 * Loads the workspace for a `/w/[slug]` route and checks membership.
 * Use in every page, layout and server action under /w/[slug].
 */
export const getWorkspace = cache(async (slug: string): Promise<WorkspaceContext> => {
  const { supabase, user } = await requireUser();
  const { data: workspace } = await supabase.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (!workspace) notFound();

  const [{ data: member }, { data: team }] = await Promise.all([
    supabase.from("workspace_members").select("role").eq("workspace_id", workspace.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("team_members").select("*").eq("workspace_id", workspace.id).order("name"),
  ]);
  if (!member) notFound();

  const teamRows = (team ?? []) as TeamMember[];
  return {
    supabase,
    user: { id: user.id, email: user.email },
    workspace: workspace as Workspace,
    role: member.role as Role,
    me: teamRows.find((t) => t.user_id === user.id) ?? null,
    team: teamRows,
  };
});

export function canAdmin(role: Role) {
  return role === "owner" || role === "admin";
}
