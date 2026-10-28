import { Tabs } from "@/components/ui/nav-link";

export function SettingsTabs({ slug }: { slug: string }) {
  const base = `/w/settings`;
  return (
    <Tabs
      items={[
        { href: base, label: "General" },
        { href: `${base}/members`, label: "Members" },
        { href: `${base}/billing`, label: "Plan & billing" },
      ]}
    />
  );
}
