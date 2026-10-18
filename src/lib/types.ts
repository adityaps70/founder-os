// Row types mirroring supabase/migrations/0001_init.sql.
// (Regenerate with `supabase gen types typescript` once you have a project, if you prefer.)

export type Role = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  currency: string;
  cash_balance: number;
  plan: string;
  plan_status: string;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  current_period_end: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface Invitation {
  id: string;
  workspace_id: string;
  email: string;
  role: Role;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  title: string | null;
  department: string | null;
  status: "active" | "inactive";
  start_date: string | null;
  created_at: string;
}

export type GoalStatus = "on_track" | "at_risk" | "off_track" | "done";
export interface Goal {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  quarter: string;
  owner_id: string | null;
  status: GoalStatus;
  target_date: string | null;
  created_at: string;
}

export interface KeyResult {
  id: string;
  workspace_id: string;
  goal_id: string;
  title: string;
  start_value: number;
  target_value: number;
  current_value: number;
  unit: string | null;
  created_at: string;
}

export type ProjectStatus = "planned" | "active" | "paused" | "done";
export interface Project {
  id: string;
  workspace_id: string;
  goal_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  due_date: string | null;
  created_at: string;
}

export type TaskStatus = "todo" | "in_progress" | "waiting" | "done";
export type Priority = "urgent" | "high" | "medium" | "low";
export interface Task {
  id: string;
  workspace_id: string;
  project_id: string | null;
  meeting_id: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: Priority;
  is_important: boolean;
  is_urgent: boolean;
  assignee_id: string | null;
  delegated_by_id: string | null;
  due_date: string | null;
  follow_up_date: string | null;
  recurrence: "daily" | "weekly" | "monthly" | null;
  source: "manual" | "capture" | "meeting" | "copilot";
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Capture {
  id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  kind: "note" | "idea" | "task";
  processed: boolean;
  created_at: string;
}

export interface OneOnOne {
  id: string;
  workspace_id: string;
  team_member_id: string;
  held_on: string;
  talking_points: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Checkin {
  id: string;
  workspace_id: string;
  team_member_id: string;
  week_start: string;
  wins: string | null;
  blockers: string | null;
  plans: string | null;
  mood: number | null;
  created_at: string;
}

export interface Meeting {
  id: string;
  workspace_id: string;
  title: string;
  starts_at: string;
  agenda: string | null;
  notes: string | null;
  attendee_ids: string[];
  created_by: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  workspace_id: string;
  meeting_id: string | null;
  title: string;
  context: string | null;
  decision: string | null;
  rationale: string | null;
  status: "proposed" | "decided" | "revisited";
  decided_by_id: string | null;
  decided_on: string;
  created_at: string;
}

export type ContactType = "lead" | "client" | "investor" | "partner" | "candidate" | "other";
export interface Contact {
  id: string;
  workspace_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  type: ContactType;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export type Pipeline = "sales" | "investors" | "partners";
export interface Deal {
  id: string;
  workspace_id: string;
  pipeline: Pipeline;
  title: string;
  contact_id: string | null;
  owner_id: string | null;
  stage: string;
  value: number;
  probability: number;
  status: "open" | "won" | "lost";
  expected_close: string | null;
  next_step: string | null;
  next_step_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  kind: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  occurred_on: string;
  is_recurring: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  number: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "void";
  issue_date: string;
  due_date: string | null;
  paid_on: string | null;
  notes: string | null;
  created_at: string;
}

export interface Kpi {
  id: string;
  workspace_id: string;
  name: string;
  unit: string | null;
  target: number | null;
  direction: "up" | "down";
  owner_id: string | null;
  created_at: string;
}

export interface KpiEntry {
  id: string;
  workspace_id: string;
  kpi_id: string;
  week_start: string;
  value: number;
  created_at: string;
}

export interface CopilotMessage {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Brief {
  id: string;
  workspace_id: string;
  user_id: string;
  brief_date: string;
  content: string;
  created_at: string;
}

/** Result shape returned by every server action used with useActionState. */
export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
