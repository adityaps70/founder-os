"use server";
import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { str } from "@/lib/utils";
import type { ActionState, Capture } from "@/lib/types";

/** Quick capture (⌘K). kind = note | idea | task. A "task" capture becomes a task immediately. */
export async function createCapture(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace, user, me } = await getWorkspace(slug);
  const content = str(fd, "content");
  if (!content) return { error: "Type something first." };
  const kind = (str(fd, "kind") ?? "note") as Capture["kind"];

  if (kind === "task") {
    const { error } = await supabase.from("tasks").insert({
      workspace_id: workspace.id,
      title: content.split("\n")[0]!.slice(0, 200),
      notes: content.includes("\n") ? content.split("\n").slice(1).join("\n").trim() || null : null,
      assignee_id: me?.id ?? null,
      source: "capture",
      created_by: user.id,
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("captures").insert({ workspace_id: workspace.id, user_id: user.id, content, kind });
    if (error) return { error: error.message };
  }
  refreshWorkspace(slug);
  return { ok: true, message: kind === "task" ? "Added to your tasks." : "Saved to your inbox." };
}

/** Turn an inbox item into a task assigned to me. */
export async function captureToTask(slug: string, id: string): Promise<void> {
  const { supabase, workspace, user, me } = await getWorkspace(slug);
  const { data: c } = await supabase.from("captures").select("*").eq("id", id).maybeSingle<Capture>();
  if (!c) return;
  await supabase.from("tasks").insert({
    workspace_id: workspace.id,
    title: c.content.split("\n")[0]!.slice(0, 200),
    notes: c.content.includes("\n") ? c.content : null,
    assignee_id: me?.id ?? null,
    source: "capture",
    created_by: user.id,
  });
  await supabase.from("captures").update({ processed: true }).eq("id", id);
  refreshWorkspace(slug);
}

export async function archiveCapture(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("captures").update({ processed: true }).eq("id", id);
  refreshWorkspace(slug);
}

export async function deleteCapture(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("captures").delete().eq("id", id);
  refreshWorkspace(slug);
}
