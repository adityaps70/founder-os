"use client";
import { useActionState } from "react";
import { createWorkspace } from "@/actions/workspace";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function OnboardingForm() {
  const [state, action] = useActionState(createWorkspace, null);
  return (
    <form action={action} className="mt-5 space-y-3">
      <Field label="Company name">
        <Input name="name" required placeholder="Acme Labs" autoFocus />
      </Field>
      <Field label="Workspace URL" hint="Lowercase letters, numbers and dashes. Leave blank to generate one.">
        <div className="flex items-center rounded-lg border border-line bg-surface-2 pl-3 text-sm text-faint">
          /w/
          <Input name="slug" placeholder="acme" className="rounded-l-none border-0 border-l" pattern="[a-z0-9-]*" />
        </div>
      </Field>
      <Field label="Currency">
        <Select name="currency" defaultValue="INR">
          <option value="INR">INR — Indian Rupee</option>
          <option value="USD">USD — US Dollar</option>
          <option value="EUR">EUR — Euro</option>
          <option value="GBP">GBP — British Pound</option>
        </Select>
      </Field>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton className="w-full">Create workspace</SubmitButton>
    </form>
  );
}
