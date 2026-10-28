import { canAdmin, getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { planFor } from "@/lib/billing/plans";
import { str } from "@/lib/utils";
import type { ActionState, Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "member"];

export async function inviteMember(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  if (!canAdmin(ctx.role)) return { error: "Only owners and admins can invite people." };
  const email = str(fd, "email")?.toLowerCase();
  const role = (str(fd, "role") as Role) ?? "member";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  if (!ROLES.includes(role)) return { error: "Pick a role." };

  const { supabase, workspace } = ctx;
  const [{ count: members }, { count: pending }] = await Promise.all([
    supabase.from("workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    supabase.from("invitations").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  const plan = planFor(workspace.plan);
  if ((members ?? 0) + (pending ?? 0) >= plan.limits.seats) {
    return { error: `The ${plan.name} plan includes ${plan.limits.seats} seats (members + pending invites). Upgrade in Billing.` };
  }

  const { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: workspace.id, email, role, invited_by: ctx.user.id });
  if (error) return { error: error.message };

  refreshWorkspace(slug);
  return { ok: true, message: `Invite created — copy the link below and send it to ${email}.` };
}

export async function revokeInvitation(slug: string, id: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  if (!canAdmin(ctx.role)) return;
  await ctx.supabase.from("invitations").delete().eq("id", id).eq("workspace_id", ctx.workspace.id);
  refreshWorkspace(slug);
}

export async function setMemberRole(slug: string, userId: string, fd: FormData): Promise<void> {
  const ctx = await getWorkspace(slug);
  const role = str(fd, "role") as Role;
  if (!canAdmin(ctx.role) || !ROLES.includes(role) || userId === ctx.user.id) return;
  // Owners can't be demoted from here.
  await ctx.supabase.from("workspace_members").update({ role }).eq("workspace_id", ctx.workspace.id).eq("user_id", userId).neq("role", "owner");
  refreshWorkspace(slug);
}

export async function removeMember(slug: string, userId: string): Promise<void> {
  const ctx = await getWorkspace(slug);
  if (!canAdmin(ctx.role) || userId === ctx.user.id) return;
  await ctx.supabase.from("workspace_members").delete().eq("workspace_id", ctx.workspace.id).eq("user_id", userId).neq("role", "owner");
  // Keep their team entry (history stays intact) but unlink the login.
  await ctx.supabase.from("team_members").update({ user_id: null }).eq("workspace_id", ctx.workspace.id).eq("user_id", userId);
  refreshWorkspace(slug);
}
