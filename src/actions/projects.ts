"use server";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { str } from "@/lib/utils";
import type { ActionState, ProjectStatus } from "@/lib/types";

const STATUSES: ProjectStatus[] = ["planned", "active", "paused", "done"];

function projectFields(fd: FormData) {
  const status = (str(fd, "status") ?? "active") as ProjectStatus;
  return {
    name: str(fd, "name") ?? "",
    description: str(fd, "description"),
    status: STATUSES.includes(status) ? status : "active",
    owner_id: str(fd, "owner_id"),
    goal_id: str(fd, "goal_id"),
    due_date: str(fd, "due_date"),
  };
}

export async function createProject(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace, me } = await getWorkspace(slug);
  const f = projectFields(fd);
  if (!f.name) return { error: "Name the project." };
  const { error } = await supabase
    .from("projects")
    .insert({ ...f, owner_id: f.owner_id ?? me?.id ?? null, workspace_id: workspace.id });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function updateProject(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, me } = await getWorkspace(slug);
  const f = projectFields(fd);
  if (!f.name) return { error: "Name the project." };
  // "Me" (empty owner) means the signed-in user, same as on create.
  const { error } = await supabase.from("projects").update({ ...f, owner_id: f.owner_id ?? me?.id ?? null }).eq("id", id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function setProjectStatus(slug: string, id: string, status: ProjectStatus): Promise<void> {
  if (!STATUSES.includes(status)) return;
  const { supabase } = await getWorkspace(slug);
  await supabase.from("projects").update({ status }).eq("id", id);
  refreshWorkspace(slug);
}

/** Deletes the project; its tasks are kept (project_id is set to null). */
export async function deleteProject(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("projects").delete().eq("id", id);
  refreshWorkspace(slug);
  redirect(`/w/${slug}/projects`);
}
