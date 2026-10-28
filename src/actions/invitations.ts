import { redirect } from "@/lib/nav";
import { loadWorkspace, requireUser } from "@/lib/workspace";
import type { ActionState } from "@/lib/types";

export async function acceptInvitation(token: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: error.message };
  const slug = (data as { slug: string }).slug;
  await loadWorkspace(slug);
  redirect(`/w/?ws=${slug}`);
  return { ok: true };
}
