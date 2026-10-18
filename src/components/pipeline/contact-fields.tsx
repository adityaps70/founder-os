import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Contact } from "@/lib/types";

export const CONTACT_TYPE_OPTIONS: { value: Contact["type"]; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "client", label: "Client" },
  { value: "investor", label: "Investor" },
  { value: "partner", label: "Partner" },
  { value: "candidate", label: "Candidate" },
  { value: "other", label: "Other" },
];

export function ContactFields({ contact }: { contact?: Contact }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" required defaultValue={contact?.name ?? ""} />
        </Field>
        <Field label="Type">
          <Select name="type" defaultValue={contact?.type ?? "lead"}>
            {CONTACT_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Company">
          <Input name="company" defaultValue={contact?.company ?? ""} />
        </Field>
        <Field label="Title">
          <Input name="title" defaultValue={contact?.title ?? ""} placeholder="CTO" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
        </Field>
        <Field label="Last contacted">
          <Input name="last_contacted_at" type="date" defaultValue={contact?.last_contacted_at ?? ""} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={contact?.notes ?? ""} placeholder="How you met, what they care about…" />
      </Field>
    </>
  );
}
