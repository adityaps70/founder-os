import type { Tone } from "@/components/ui/badge";
import type { GoalStatus, Pipeline, Priority, ProjectStatus, TaskStatus } from "@/lib/types";

export const TASK_STATUSES: { value: TaskStatus; label: string; tone: Tone }[] = [
  { value: "todo", label: "To do", tone: "gray" },
  { value: "in_progress", label: "In progress", tone: "blue" },
  { value: "waiting", label: "Waiting", tone: "amber" },
  { value: "done", label: "Done", tone: "green" },
];

export const PRIORITIES: { value: Priority; label: string; tone: Tone }[] = [
  { value: "urgent", label: "Urgent", tone: "red" },
  { value: "high", label: "High", tone: "amber" },
  { value: "medium", label: "Medium", tone: "blue" },
  { value: "low", label: "Low", tone: "gray" },
];

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export const GOAL_STATUSES: { value: GoalStatus; label: string; tone: Tone }[] = [
  { value: "on_track", label: "On track", tone: "green" },
  { value: "at_risk", label: "At risk", tone: "amber" },
  { value: "off_track", label: "Off track", tone: "red" },
  { value: "done", label: "Done", tone: "purple" },
];

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: Tone }[] = [
  { value: "planned", label: "Planned", tone: "gray" },
  { value: "active", label: "Active", tone: "blue" },
  { value: "paused", label: "Paused", tone: "amber" },
  { value: "done", label: "Done", tone: "green" },
];

/** Stages per pipeline, with default win probability for each. */
export const PIPELINE_STAGES: Record<Pipeline, { value: string; label: string; probability: number }[]> = {
  sales: [
    { value: "lead", label: "Lead", probability: 10 },
    { value: "qualified", label: "Qualified", probability: 25 },
    { value: "proposal", label: "Proposal", probability: 50 },
    { value: "negotiation", label: "Negotiation", probability: 75 },
  ],
  investors: [
    { value: "target", label: "Target", probability: 5 },
    { value: "intro", label: "Intro / first call", probability: 15 },
    { value: "diligence", label: "Diligence", probability: 40 },
    { value: "term_sheet", label: "Term sheet", probability: 80 },
  ],
  partners: [
    { value: "identified", label: "Identified", probability: 10 },
    { value: "talking", label: "In talks", probability: 30 },
    { value: "pilot", label: "Pilot", probability: 60 },
    { value: "signing", label: "Signing", probability: 85 },
  ],
};

export const PIPELINES: { value: Pipeline; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "investors", label: "Fundraising" },
  { value: "partners", label: "Partnerships" },
];

export const EXPENSE_CATEGORIES = ["Payroll", "Software", "Marketing", "Rent", "Contractors", "Travel", "Legal & Admin", "Taxes", "Other"];
export const INCOME_CATEGORIES = ["Revenue", "Services", "Investment", "Grant", "Interest", "Other"];

export function labelFor<T extends { value: string; label: string }>(list: T[], value: string | null | undefined) {
  return list.find((i) => i.value === value) ?? null;
}
