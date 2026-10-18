import { Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { deleteDeal, setDealStatus, updateDeal } from "@/actions/pipeline";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Contact, Deal, TeamMember } from "@/lib/types";
import { cn, formatMoney, relativeDay, todayISO } from "@/lib/utils";
import { DealFields } from "./deal-fields";

const iconBtn = "flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-surface-2";

interface DealCardProps {
  slug: string;
  deal: Deal;
  team: TeamMember[];
  contacts: Pick<Contact, "id" | "name" | "company">[];
  currency: string;
}

/** Informational part of a deal card (this is the draggable area on the board). */
export function DealCardBody({ deal, team, contacts, currency }: Omit<DealCardProps, "slug">) {
  const contact = contacts.find((c) => c.id === deal.contact_id);
  const owner = team.find((t) => t.id === deal.owner_id);
  const today = todayISO();
  const due = deal.next_step_date && deal.next_step_date <= today;
  const overdue = deal.next_step_date && deal.next_step_date < today;

  return (
    <div className="p-3 pb-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium leading-snug text-fg">{deal.title}</p>
        {owner && <Avatar name={owner.name} size="sm" />}
      </div>
      {contact && (
        <p className="mt-0.5 truncate text-xs text-muted">
          {contact.name}
          {contact.company ? ` · ${contact.company}` : ""}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-fg">{formatMoney(Number(deal.value), currency, true)}</span>
        <Badge tone="gray">{deal.probability}%</Badge>
      </div>
      {(deal.next_step || deal.next_step_date) && (
        <p className={cn("mt-2 truncate text-xs", overdue ? "font-medium text-danger" : due ? "font-medium text-warning" : "text-muted")}>
          → {deal.next_step ?? "Follow up"}
          {deal.next_step_date ? ` · ${relativeDay(deal.next_step_date)}` : ""}
        </p>
      )}
    </div>
  );
}

/**
 * Buttons row of a deal card. Kept outside the draggable element so the edit dialog's
 * inputs behave normally in every browser.
 */
export function DealCardActions({ slug, deal, team, contacts, currency }: DealCardProps) {
  return (
    <div className="mx-3 flex items-center justify-end gap-0.5 border-t border-line py-1">
        <form action={setDealStatus.bind(null, slug, deal.id, "won")}>
          <button type="submit" className={cn(iconBtn, "hover:text-success")} title="Mark won" aria-label="Mark won">
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
        </form>
        <form action={setDealStatus.bind(null, slug, deal.id, "lost")}>
          <button type="submit" className={cn(iconBtn, "hover:text-danger")} title="Mark lost" aria-label="Mark lost">
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </form>
        <FormDialog
          title="Edit deal"
          trigger={<Pencil className="h-3.5 w-3.5" />}
          triggerVariant="ghost"
          triggerSize="icon"
          action={updateDeal.bind(null, slug, deal.id)}
          wide
        >
          <DealFields pipeline={deal.pipeline} team={team} contacts={contacts} deal={deal} currency={currency} />
        </FormDialog>
        <form action={deleteDeal.bind(null, slug, deal.id)}>
          <button type="submit" className={cn(iconBtn, "hover:text-danger")} title="Delete" aria-label="Delete deal">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
    </div>
  );
}
