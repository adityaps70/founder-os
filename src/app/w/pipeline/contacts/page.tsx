"use client";
import { AsyncPage } from "@/components/shell/async-page";
import Link from "next/link";
import { Mail, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { createContact, deleteContact, touchContact, updateContact } from "@/actions/pipeline";
import { CONTACT_TYPE_OPTIONS, ContactFields } from "@/components/pipeline/contact-fields";
import { PipelineTabs } from "@/components/pipeline/pipeline-tabs";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, type Tone } from "@/components/ui";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Contact, ContactType, Deal } from "@/lib/types";
import { cn, formatDate, todayISO } from "@/lib/utils";
import { getWorkspace } from "@/lib/workspace";

const TYPE_TONE: Record<ContactType, Tone> = {
  lead: "blue",
  client: "green",
  investor: "purple",
  partner: "amber",
  candidate: "gray",
  other: "gray",
};
const COLD_TYPES: ContactType[] = ["lead", "client", "investor"];

async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { slug } = await params;
  const { type, q } = await searchParams;
  const { supabase, workspace } = await getWorkspace(slug);
  const validType = CONTACT_TYPE_OPTIONS.some((t) => t.value === type) ? (type as ContactType) : null;

  let query = supabase.from("contacts").select("*").eq("workspace_id", workspace.id).order("name").limit(500);
  if (validType) query = query.eq("type", validType);
  const search = q?.replace(/[%*,()"\\]/g, " ").trim();
  if (search) query = query.or(`name.ilike.*${search}*,company.ilike.*${search}*,email.ilike.*${search}*`);

  const [{ data: contactRows }, { data: dealRows }] = await Promise.all([
    query,
    supabase.from("deals").select("id, contact_id, status").eq("workspace_id", workspace.id).eq("status", "open"),
  ]);
  const contacts = (contactRows ?? []) as Contact[];
  const openDeals = new Map<string, number>();
  for (const d of (dealRows ?? []) as Pick<Deal, "id" | "contact_id" | "status">[]) {
    if (d.contact_id) openDeals.set(d.contact_id, (openDeals.get(d.contact_id) ?? 0) + 1);
  }
  const coldCutoff = todayISO(-30);

  const add = (
    <FormDialog title="New contact" trigger="Add contact" triggerIcon={<Plus className="h-4 w-4" />} action={createContact.bind(null, slug)} submitLabel="Create" wide>
      <ContactFields />
    </FormDialog>
  );

  return (
    <>
      <PageHeader title="Pipeline" description="Everyone you're building relationships with." actions={add} />
      <PipelineTabs slug={slug} active="contacts" />

      <form className="mb-4 flex flex-wrap gap-2" action={`/w/pipeline/contacts`}>
        <Input name="q" defaultValue={q ?? ""} placeholder="Search name, company or email" className="max-w-xs" />
        <Select name="type" defaultValue={validType ?? ""} className="w-40">
          <option value="">All types</option>
          {CONTACT_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(q || validType) && (
          <Link href={`/w/pipeline/contacts`} className="self-center text-xs text-muted hover:text-fg">
            Clear
          </Link>
        )}
      </form>

      <Card>
        {contacts.length === 0 ? (
          <EmptyState icon={Users} title={q || validType ? "No contacts match" : "No contacts yet"} description="Leads, clients, investors and partners all live here." action={q || validType ? undefined : add} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Reach</th>
                  <th className="px-4 py-2.5 font-medium">Last contact</th>
                  <th className="px-4 py-2.5 font-medium">Open deals</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {contacts.map((c) => {
                  const cold = COLD_TYPES.includes(c.type) && (!c.last_contacted_at || c.last_contacted_at < coldCutoff);
                  const typeLabel = CONTACT_TYPE_OPTIONS.find((t) => t.value === c.type)?.label ?? c.type;
                  return (
                    <tr key={c.id} className="group">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-fg">{c.name}</p>
                        <p className="text-xs text-faint">{[c.title, c.company].filter(Boolean).join(" · ") || "—"}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={TYPE_TONE[c.type]}>{typeLabel}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 text-muted">
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="hover:text-fg" title={c.email} aria-label={`Email ${c.name}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          )}
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="hover:text-fg" title={c.phone} aria-label={`Call ${c.name}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          {!c.email && !c.phone && <span className="text-faint">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("tabular-nums", cold ? "text-muted" : "text-fg")}>{formatDate(c.last_contacted_at)}</span>
                          {cold && <Badge tone="amber">Going cold</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted">{openDeals.get(c.id) ?? 0}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <form action={touchContact.bind(null, slug, c.id)}>
                            <Button type="submit" variant="secondary" size="sm">
                              Log touch
                            </Button>
                          </form>
                          <FormDialog
                            title="Edit contact"
                            trigger={<Pencil className="h-3.5 w-3.5" />}
                            triggerVariant="ghost"
                            triggerSize="icon"
                            action={updateContact.bind(null, slug, c.id)}
                            wide
                          >
                            <ContactFields contact={c} />
                          </FormDialog>
                          <form action={deleteContact.bind(null, slug, c.id)}>
                            <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger" aria-label="Delete contact">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export default function Page() {
  return <AsyncPage render={ContactsPage} title={"Contacts"} />;
}
