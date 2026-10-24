import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { WorkspaceContext } from "@/lib/workspace";
import { todayISO } from "@/lib/utils";
import { buildSnapshot } from "./context";

export const COPILOT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const PERSONA = `You are the Copilot inside Founder OS — a sharp, practical chief of staff for a startup founder.
You see a live snapshot of their company below (tasks, team, goals, meetings, pipeline, finances, KPIs).
Rules:
- Be concise and specific. Use the founder's real data: names, numbers, dates. Never invent data that is not in the snapshot; say what's missing instead.
- Prefer short bullet lists and clear next actions. Use **bold** sparingly. Use ### for section headings only when the answer has several parts.
- Money is in the company's currency. Dates are YYYY-MM-DD in the snapshot; present them naturally ("Thu 23 Oct").
- When the founder asks you to create tasks, log a decision, change a task, or save a note, use the tools. Confirm briefly what you did.
- Only create things the founder asked for, or that they clearly agreed to. Don't spam tasks.
- For drafts (emails, investor updates, announcements), write them ready to send, in a warm, direct founder voice.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_task",
    description: "Create a task in Founder OS. Use the team_id from the snapshot to assign it to someone; omit to assign to the founder.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short imperative title" },
        assignee_team_id: { type: "string", description: "team_id of the owner (from the snapshot)" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        notes: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task by its id (shown as {id:...} in the snapshot).",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "waiting", "done"] },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
      },
      required: ["task_id"],
    },
  },
  {
    name: "log_decision",
    description: "Record a decision in the decision log.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        decision: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["title", "decision"],
    },
  },
  {
    name: "save_note",
    description: "Save an idea or note to the founder's inbox for later.",
    input_schema: {
      type: "object",
      properties: { content: { type: "string" }, kind: { type: "string", enum: ["idea", "note"] } },
      required: ["content"],
    },
  },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ["urgent", "high", "medium", "low"];
const STATUSES = ["todo", "in_progress", "waiting", "done"];

async function runTool(ctx: WorkspaceContext, name: string, input: Record<string, unknown>): Promise<{ result: string; action?: string }> {
  const { supabase, workspace, user, me, team } = ctx;
  const s = (k: string) => (typeof input[k] === "string" && (input[k] as string).trim() ? (input[k] as string).trim() : null);

  if (name === "create_task") {
    const title = s("title");
    if (!title) return { result: "Error: title is required" };
    const assignee = team.find((t) => t.id === s("assignee_team_id"))?.id ?? me?.id ?? null;
    const due = s("due_date");
    const priority = PRIORITIES.includes(s("priority") ?? "") ? s("priority")! : "medium";
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspace.id,
        title: title.slice(0, 200),
        notes: s("notes"),
        assignee_id: assignee,
        delegated_by_id: assignee && me && assignee !== me.id ? me.id : null,
        due_date: due && DATE.test(due) ? due : null,
        priority,
        is_important: priority === "urgent" || priority === "high",
        is_urgent: priority === "urgent",
        source: "copilot",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { result: `Error: ${error.message}` };
    const who = team.find((t) => t.id === assignee)?.name ?? "you";
    return { result: `Created task ${data.id}`, action: `Created task “${title}” for ${who}${due ? ` (due ${due})` : ""}` };
  }

  if (name === "update_task") {
    const id = s("task_id");
    if (!id) return { result: "Error: task_id is required" };
    const patch: Record<string, unknown> = {};
    const status = s("status");
    if (status && STATUSES.includes(status)) {
      patch.status = status;
      patch.completed_at = status === "done" ? new Date().toISOString() : null;
    }
    const due = s("due_date");
    if (due && DATE.test(due)) patch.due_date = due;
    const pr = s("priority");
    if (pr && PRIORITIES.includes(pr)) patch.priority = pr;
    if (!Object.keys(patch).length) return { result: "Error: nothing to update" };
    const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).eq("workspace_id", workspace.id).select("title").maybeSingle();
    if (error) return { result: `Error: ${error.message}` };
    if (!data) return { result: "Error: task not found" };
    return { result: "Updated", action: `Updated “${data.title}”` };
  }

  if (name === "log_decision") {
    const title = s("title");
    const decision = s("decision");
    if (!title || !decision) return { result: "Error: title and decision are required" };
    const { error } = await supabase.from("decisions").insert({
      workspace_id: workspace.id,
      title,
      decision,
      rationale: s("rationale"),
      decided_by_id: me?.id ?? null,
      decided_on: todayISO(),
    });
    if (error) return { result: `Error: ${error.message}` };
    return { result: "Logged", action: `Logged decision “${title}”` };
  }

  if (name === "save_note") {
    const content = s("content");
    if (!content) return { result: "Error: content is required" };
    const kind = s("kind") === "idea" ? "idea" : "note";
    const { error } = await supabase.from("captures").insert({ workspace_id: workspace.id, user_id: user.id, content, kind });
    if (error) return { result: `Error: ${error.message}` };
    return { result: "Saved", action: `Saved ${kind} to your inbox` };
  }

  return { result: `Error: unknown tool ${name}` };
}

export interface CopilotTurn {
  reply: string;
  actions: string[];
}

/** Run one Copilot turn with tool use. `history` is prior conversation (oldest first). */
export async function runCopilot(
  ctx: WorkspaceContext,
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
): Promise<CopilotTurn> {
  const snapshot = await buildSnapshot(ctx);
  const system = `${PERSONA}\n\n<company_snapshot>\n${snapshot}\n</company_snapshot>`;
  const messages: Anthropic.MessageParam[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: message }];
  const actions: string[] = [];
  const ai = client();

  for (let step = 0; step < 6; step++) {
    const res = await ai.messages.create({ model: COPILOT_MODEL, max_tokens: 2000, system, tools: TOOLS, messages });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (res.stop_reason !== "tool_use") {
      return { reply: text || (actions.length ? "Done." : "I don't have an answer for that yet."), actions };
    }

    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const out = await runTool(ctx, block.name, (block.input ?? {}) as Record<string, unknown>);
      if (out.action) actions.push(out.action);
      results.push({ type: "tool_result", tool_use_id: block.id, content: out.result, is_error: out.result.startsWith("Error") });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "I made the changes above.", actions };
}

const BRIEF_PROMPT = `Write my morning brief for today. Format (markdown, under 220 words):
### Top 3 for today
Numbered — the three highest-leverage things I should do today, each with a one-line why. Prefer overdue or due-today items, deals with due next steps, and blocked goals.
### Watch out
2–4 bullets: risks (overdue items, cold deals, overdue invoices, runway, KPIs off track, people overloaded).
### Waiting on
Up to 3 bullets of delegated items I should chase today (who + what).
If the workspace is mostly empty, instead give 3 concrete setup steps to get value from Founder OS.`;

/** Generate the daily brief text (no tools). */
export async function runBrief(ctx: WorkspaceContext): Promise<string> {
  const snapshot = await buildSnapshot(ctx);
  const res = await client().messages.create({
    model: COPILOT_MODEL,
    max_tokens: 900,
    system: `${PERSONA}\n\n<company_snapshot>\n${snapshot}\n</company_snapshot>`,
    messages: [{ role: "user", content: BRIEF_PROMPT }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
