"use server";
import { getWorkspace, type WorkspaceContext } from "@/lib/workspace";
import { refreshWorkspace } from "@/lib/revalidate";
import { checkLimit } from "@/lib/billing/limits";
import { PIPELINE_STAGES } from "@/lib/constants";
import { num, str, todayISO } from "@/lib/utils";
import type { ActionState, ContactType, Pipeline } from "@/lib/types";

const PIPELINE_IDS: Pipeline[] = ["sales", "investors", "partners"];
const CONTACT_TYPES: ContactType[] = ["lead", "client", "investor", "partner", "candidate", "other"];

function asPipeline(v: string | null): Pipeline {
  return PIPELINE_IDS.includes(v as Pipeline) ? (v as Pipeline) : "sales";
}

function stageFor(pipeline: Pipeline, stage: string | null) {
  const stages = PIPELINE_STAGES[pipeline];
  return stages.find((s) => s.value === stage) ?? stages[0]!;
}

function contactTypeForPipeline(p: Pipeline): ContactType {
  return p === "investors" ? "investor" : p === "partners" ? "partner" : "lead";
}

/** Resolve contact_id from the form: an existing contact, or create one from new_contact name. */
async function resolveContact(ctx: WorkspaceContext, fd: FormData, pipeline: Pipeline): Promise<{ id: string | null; error?: string }> {
  const newName = str(fd, "new_contact");
  if (newName) {
    const { data, error } = await ctx.supabase
      .from("contacts")
      .insert({
        workspace_id: ctx.workspace.id,
        name: newName,
        company: str(fd, "new_contact_company"),
        type: contactTypeForPipeline(pipeline),
      })
      .select("id")
      .single();
    if (error) return { id: null, error: error.message };
    return { id: (data as { id: string }).id };
  }
  return { id: str(fd, "contact_id") };
}

function dealFields(fd: FormData, pipeline: Pipeline) {
  const stage = stageFor(pipeline, str(fd, "stage"));
  const prob = num(fd, "probability");
  return {
    title: str(fd, "title") ?? "",
    owner_id: str(fd, "owner_id"),
    stage: stage.value,
    value: Math.max(0, num(fd, "value") ?? 0),
    probability: prob === null ? stage.probability : Math.max(0, Math.min(100, Math.round(prob))),
    expected_close: str(fd, "expected_close"),
    next_step: str(fd, "next_step"),
    next_step_date: str(fd, "next_step_date"),
  };
}

export async function createDeal(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const pipeline = asPipeline(str(fd, "pipeline"));
  const f = dealFields(fd, pipeline);
  if (!f.title) return { error: "Give the deal a name." };
  const over = await checkLimit(ctx, "openDeals");
  if (over) return { error: over };
  const contact = await resolveContact(ctx, fd, pipeline);
  if (contact.error) return { error: contact.error };
  const { error } = await ctx.supabase.from("deals").insert({
    ...f,
    owner_id: f.owner_id ?? ctx.me?.id ?? null,
    contact_id: contact.id,
    pipeline,
    workspace_id: ctx.workspace.id,
  });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function updateDeal(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspace(slug);
  const { data: deal } = await ctx.supabase.from("deals").select("pipeline").eq("id", id).maybeSingle();
  if (!deal) return { error: "Deal not found." };
  const pipeline = asPipeline((deal as { pipeline: string }).pipeline);
  const f = dealFields(fd, pipeline);
  if (!f.title) return { error: "Give the deal a name." };
  const contact = await resolveContact(ctx, fd, pipeline);
  if (contact.error) return { error: contact.error };
  const { error } = await ctx.supabase
    .from("deals")
    .update({ ...f, owner_id: f.owner_id ?? ctx.me?.id ?? null, contact_id: contact.id })
    .eq("id", id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** Drag-and-drop stage change. Resets probability to the stage default. */
export async function moveDeal(slug: string, id: string, stage: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  const { data: deal } = await supabase.from("deals").select("pipeline").eq("id", id).maybeSingle();
  if (!deal) return;
  const pipeline = asPipeline((deal as { pipeline: string }).pipeline);
  const s = PIPELINE_STAGES[pipeline].find((x) => x.value === stage);
  if (!s) return;
  await supabase.from("deals").update({ stage: s.value, probability: s.probability, status: "open" }).eq("id", id);
  refreshWorkspace(slug);
}

export async function setDealStatus(slug: string, id: string, status: "open" | "won" | "lost"): Promise<void> {
  if (!["open", "won", "lost"].includes(status)) return;
  const ctx = await getWorkspace(slug);
  let probability: number;
  if (status === "open") {
    const over = await checkLimit(ctx, "openDeals");
    if (over) return;
    // Reopening: restore the stage's default probability.
    const { data: deal } = await ctx.supabase.from("deals").select("pipeline, stage").eq("id", id).maybeSingle();
    if (!deal) return;
    const d = deal as { pipeline: string; stage: string };
    probability = stageFor(asPipeline(d.pipeline), d.stage).probability;
  } else {
    probability = status === "won" ? 100 : 0;
  }
  await ctx.supabase.from("deals").update({ status, probability }).eq("id", id);
  refreshWorkspace(slug);
}

export async function deleteDeal(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("deals").delete().eq("id", id);
  refreshWorkspace(slug);
}

// ─── Contacts ──────────────────────────────────────────────

function contactFields(fd: FormData) {
  const type = str(fd, "type") as ContactType | null;
  return {
    name: str(fd, "name") ?? "",
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    company: str(fd, "company"),
    title: str(fd, "title"),
    type: type && CONTACT_TYPES.includes(type) ? type : "lead",
    notes: str(fd, "notes"),
    last_contacted_at: str(fd, "last_contacted_at"),
  };
}

export async function createContact(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, workspace } = await getWorkspace(slug);
  const f = contactFields(fd);
  if (!f.name) return { error: "Name is required." };
  const { error } = await supabase.from("contacts").insert({ ...f, workspace_id: workspace.id });
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

export async function updateContact(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await getWorkspace(slug);
  const f = contactFields(fd);
  if (!f.name) return { error: "Name is required." };
  const { error } = await supabase.from("contacts").update(f).eq("id", id);
  if (error) return { error: error.message };
  refreshWorkspace(slug);
  return { ok: true };
}

/** "Log touch": mark the contact as contacted today. */
export async function touchContact(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("contacts").update({ last_contacted_at: todayISO() }).eq("id", id);
  refreshWorkspace(slug);
}

export async function deleteContact(slug: string, id: string): Promise<void> {
  const { supabase } = await getWorkspace(slug);
  await supabase.from("contacts").delete().eq("id", id);
  refreshWorkspace(slug);
}
