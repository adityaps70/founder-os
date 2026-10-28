import { redirect } from "@/lib/nav";
import { requireUser, getWorkspace, canAdmin, clearWorkspace, loadWorkspace, LAST_WS_KEY } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { num, slugify, str } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

export async function createWorkspace(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = str(fd, "name");
  if (!name) return { error: "Name your company." };
  const base = slugify(str(fd, "slug") ?? name) || "company";
  const currency = str(fd, "currency") ?? "INR";

  let slug = base.length < 3 ? `${base}-co` : base;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase.rpc("create_workspace", { p_name: name, p_slug: slug, p_currency: currency });
    if (!error && data) {
      const created = data as { slug: string };
      await loadWorkspace(created.slug);
      return redirect(`/w/?ws=${created.slug}`);
    }
    if (error && !/duplicate|unique/i.test(error.message)) return { error: error.message };
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return { error: "Could not create the workspace. Try a different name." };
}

export async function updateWorkspace(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace, role } = await getWorkspace(slug);
  if (!canAdmin(role)) return { error: "Only admins can change workspace settings." };
  const name = str(fd, "name");
  if (!name) return { error: "Name is required." };
  const { error } = await supabase
    .from("workspaces")
    .update({ name, currency: str(fd, "currency") ?? workspace.currency })
    .eq("id", workspace.id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true, message: "Saved." };
}

/** Update the cash-in-bank figure used for runway. */
export async function updateCashBalance(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace, role } = await getWorkspace(slug);
  // RLS only lets admins update workspaces; a member's update would silently match 0 rows.
  if (!canAdmin(role)) return { error: "Only owners and admins can update the cash balance." };
  const cash = num(fd, "cash_balance");
  if (cash === null) return { error: "Enter an amount." };
  const { error } = await supabase.from("workspaces").update({ cash_balance: cash }).eq("id", workspace.id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function deleteWorkspace(slug: string, fd: FormData): Promise<void> {
  const { supabase, workspace, role } = await getWorkspace(slug);
  if (role !== "owner" || str(fd, "confirm") !== workspace.slug) return;
  await supabase.from("workspaces").delete().eq("id", workspace.id);
  try {
    localStorage.removeItem(LAST_WS_KEY);
  } catch {
    /* storage unavailable */
  }
  clearWorkspace();
  redirect("/app/");
}
