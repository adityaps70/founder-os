import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Contact } from "@/lib/types";
import { todayISO } from "@/lib/utils";

export function InvoiceFields({
  nextNumber,
  contacts,
  currency,
}: {
  nextNumber: string;
  contacts: Pick<Contact, "id" | "name" | "company">[];
  currency: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Invoice number">
          <Input name="number" defaultValue={nextNumber} required />
        </Field>
        <Field label="Client">
          <Select name="contact_id" defaultValue="">
            <option value="">No client</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Amount (${currency})`}>
          <Input name="amount" type="number" min={0} step="any" required />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
          </Select>
        </Field>
        <Field label="Issue date">
          <Input name="issue_date" type="date" defaultValue={todayISO()} />
        </Field>
        <Field label="Due date">
          <Input name="due_date" type="date" defaultValue={todayISO(15)} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" placeholder="What this invoice covers" />
      </Field>
    </>
  );
}
