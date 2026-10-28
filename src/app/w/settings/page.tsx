"use client";
import { AsyncPage } from "@/components/shell/async-page";
import { deleteWorkspace, updateWorkspace } from "@/actions/workspace";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardBody, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { canAdmin, getWorkspace } from "@/lib/workspace";
import { SettingsTabs } from "./settings-tabs";

async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace, role } = await getWorkspace(slug);
  const admin = canAdmin(role);

  return (
    <>
      <PageHeader title="Settings" description={`Manage ${workspace.name}.`} />
      <SettingsTabs slug={slug} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Company" description="Name and currency used across the workspace." />
          <CardBody>
            <ActionForm action={updateWorkspace.bind(null, slug)} resetOnSuccess={false} className="space-y-3">
              <Field label="Company name">
                <Input name="name" defaultValue={workspace.name} required disabled={!admin} />
              </Field>
              <Field label="Currency">
                <Select name="currency" defaultValue={workspace.currency} disabled={!admin}>
                  {["INR", "USD", "EUR", "GBP"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Workspace URL" hint="The URL can't be changed after creation.">
                <Input value={`/w/${workspace.slug}`} disabled readOnly />
              </Field>
              {admin && <SubmitButton>Save changes</SubmitButton>}
            </ActionForm>
          </CardBody>
        </Card>

        {role === "owner" && (
          <Card className="border-red-500/30">
            <CardHeader title="Delete workspace" description="Permanently deletes this company and all of its data. This can't be undone." />
            <CardBody>
              <form action={deleteWorkspace.bind(null, slug)} className="space-y-3">
                <Field label={`Type "${workspace.slug}" to confirm`}>
                  <Input name="confirm" autoComplete="off" pattern={workspace.slug} required />
                </Field>
                <SubmitButton variant="danger">Delete workspace</SubmitButton>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <AsyncPage render={SettingsPage} title={"Settings"} />;
}
