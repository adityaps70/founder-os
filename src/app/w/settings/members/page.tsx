"use client";
import { AsyncPage } from "@/components/shell/async-page";
import { Mail, Trash2, UserPlus } from "lucide-react";
import { inviteMember, removeMember, revokeInvitation, setMemberRole } from "@/actions/members";
import { FormDialog } from "@/components/ui/form-dialog";
import { Avatar, Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { planFor } from "@/lib/billing/plans";
import type { Invitation, Role } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { canAdmin, getWorkspace } from "@/lib/workspace";
import { SettingsTabs } from "../settings-tabs";
import { CopyLink } from "./copy-link";
import { appUrl } from "@/lib/nav";

async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const { supabase, workspace, role, user } = ctx;
  const admin = canAdmin(role);

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", workspace.id).order("created_at"),
    admin
      ? supabase.from("invitations").select("*").eq("workspace_id", workspace.id).is("accepted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = (id: string) =>
    (profiles ?? []).find((p: { id: string; full_name: string | null }) => p.id === id)?.full_name ??
    ctx.team.find((t) => t.user_id === id)?.name ??
    "Member";
  const emailOf = (id: string) => ctx.team.find((t) => t.user_id === id)?.email ?? "";
  const plan = planFor(workspace.plan);
  const pending = (invites ?? []) as Invitation[];

  return (
    <>
      <PageHeader
        title="Settings"
        description={`${(members ?? []).length + pending.length} of ${plan.limits.seats} seats used on the ${plan.name} plan.`}
        actions={
          admin && (
            <FormDialog
              title="Invite a teammate"
              description="They'll get a link to join this workspace with their own login."
              trigger="Invite"
              triggerIcon={<UserPlus className="h-4 w-4" />}
              submitLabel="Send invite"
              action={inviteMember.bind(null, slug)}
            >
              <Field label="Email">
                <Input name="email" type="email" required placeholder="name@company.com" />
              </Field>
              <Field label="Role" hint="Admins can invite people, change settings and billing.">
                <Select name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
            </FormDialog>
          )
        }
      />
      <SettingsTabs slug={slug} />

      <Card className="mb-6">
        <CardHeader title="Members" description="People who can sign in to this workspace." />
        <div className="divide-y divide-line">
          {(members ?? []).map((m: { user_id: string; role: Role; created_at: string }) => (
            <div key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={nameOf(m.user_id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {nameOf(m.user_id)} {m.user_id === user.id && <span className="text-xs text-faint">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted">{emailOf(m.user_id) || `Joined ${formatDate(m.created_at)}`}</p>
              </div>
              {admin && m.role !== "owner" && m.user_id !== user.id ? (
                <div className="flex items-center gap-1">
                  <form action={setMemberRole.bind(null, slug, m.user_id)} className="flex items-center gap-1">
                    <Select name="role" defaultValue={m.role} className="h-8 w-28 text-xs">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <button type="submit" className="rounded-lg px-2 py-1 text-xs text-accent hover:bg-surface-2">
                      Save
                    </button>
                  </form>
                  <form action={removeMember.bind(null, slug, m.user_id)}>
                    <button type="submit" className="rounded-lg p-2 text-faint hover:bg-surface-2 hover:text-danger" aria-label="Remove member">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              ) : (
                <Badge tone={m.role === "owner" ? "purple" : m.role === "admin" ? "blue" : "gray"}>{m.role}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {admin && (
        <Card>
          <CardHeader title="Pending invitations" description="Invite links expire after 7 days." />
          {pending.length === 0 ? (
            <EmptyState icon={Mail} title="No pending invites" description="Invite co-founders and team leads so they can manage their own tasks and check-ins." />
          ) : (
            <div className="divide-y divide-line">
              {pending.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                return (
                  <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{i.email}</p>
                      <p className="text-xs text-muted">
                        {i.role} · {expired ? "expired" : `expires ${formatDate(i.expires_at)}`}
                      </p>
                    </div>
                    {!expired && <CopyLink url={appUrl(`/invite/?token=${i.token}`)} />}
                    <form action={revokeInvitation.bind(null, slug, i.id)}>
                      <button type="submit" className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-danger">
                        Revoke
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export default function Page() {
  return <AsyncPage render={MembersPage} title={"Members"} />;
}
