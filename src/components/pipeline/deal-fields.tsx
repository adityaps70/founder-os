import { Field, Input, Select } from "@/components/ui/input";
import { PIPELINE_STAGES } from "@/lib/constants";
import type { Contact, Deal, Pipeline, TeamMember } from "@/lib/types";

/** Form fields for creating/editing a deal. */
export function DealFields({
  pipeline,
  team,
  contacts,
  deal,
  currency,
}: {
  pipeline: Pipeline;
  team: TeamMember[];
  contacts: Pick<Contact, "id" | "name" | "company">[];
  deal?: Deal;
  currency: string;
}) {
  const stages = PIPELINE_STAGES[pipeline];
  const valueLabel = pipeline === "investors" ? `Amount (${currency})` : `Value (${currency})`;
  return (
    <>
      {!deal && <input type="hidden" name="pipeline" value={pipeline} />}
      <Field label={pipeline === "investors" ? "Investor / round" : "Deal name"}>
        <Input
          name="title"
          required
          defaultValue={deal?.title ?? ""}
          placeholder={pipeline === "investors" ? "Seed — Sequoia Surge" : pipeline === "partners" ? "Distribution partnership" : "Annual plan — Acme"}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Contact">
          <Select name="contact_id" defaultValue={deal?.contact_id ?? ""}>
            <option value="">No contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="…or add a new contact" hint="Creates the contact and links it">
          <Input name="new_contact" placeholder="Name" />
        </Field>
        <Field label="New contact's company">
          <Input name="new_contact_company" placeholder="Company (optional)" />
        </Field>
        <Field label="Owner">
          <Select name="owner_id" defaultValue={deal?.owner_id ?? ""}>
            <option value="">Me</option>
            {team
              .filter((t) => t.status === "active")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Stage">
          <Select name="stage" defaultValue={deal?.stage ?? stages[0]!.value}>
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Probability (%)" hint="Blank = stage default">
          <Input name="probability" type="number" min={0} max={100} defaultValue={deal ? String(deal.probability) : ""} />
        </Field>
        <Field label={valueLabel}>
          <Input name="value" type="number" min={0} step="any" defaultValue={deal ? String(Number(deal.value)) : ""} placeholder="0" />
        </Field>
        <Field label="Expected close">
          <Input name="expected_close" type="date" defaultValue={deal?.expected_close ?? ""} />
        </Field>
        <Field label="Next step">
          <Input name="next_step" defaultValue={deal?.next_step ?? ""} placeholder="Send proposal" />
        </Field>
        <Field label="Next step date">
          <Input name="next_step_date" type="date" defaultValue={deal?.next_step_date ?? ""} />
        </Field>
      </div>
    </>
  );
}
