import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { todayISO } from "@/lib/utils";

export function TransactionFields({ kind, currency }: { kind: "income" | "expense"; currency: string }) {
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={`Amount (${currency})`}>
          <Input name="amount" type="number" min={0} step="any" required autoFocus />
        </Field>
        <Field label="Date">
          <Input name="occurred_on" type="date" defaultValue={todayISO()} />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={categories[0]}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Input name="description" placeholder={kind === "income" ? "Client payment" : "AWS bill"} />
        </Field>
      </div>
      <Checkbox name="is_recurring" label="Recurring every month" />
    </>
  );
}
