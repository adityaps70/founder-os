import { Field, Input } from "@/components/ui/input";
import type { TeamMember } from "@/lib/types";

export function MemberFields({ member }: { member?: TeamMember }) {
  return (
    <>
      <Field label="Name">
        <Input name="name" required defaultValue={member?.name ?? ""} placeholder="Priya Sharma" autoFocus />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Email" hint="Optional. Used for nudges and to link their login later.">
          <Input name="email" type="email" defaultValue={member?.email ?? ""} placeholder="priya@company.com" />
        </Field>
        <Field label="Title">
          <Input name="title" defaultValue={member?.title ?? ""} placeholder="Head of Sales" />
        </Field>
        <Field label="Department">
          <Input name="department" defaultValue={member?.department ?? ""} placeholder="Sales" />
        </Field>
        <Field label="Start date">
          <Input name="start_date" type="date" defaultValue={member?.start_date ?? ""} />
        </Field>
      </div>
    </>
  );
}
