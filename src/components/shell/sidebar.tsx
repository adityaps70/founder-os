"use client";
import { LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { NavLink } from "@/components/ui/nav-link";
import { NAV } from "./nav";
import { QuickCapture } from "./quick-capture";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function Sidebar({
  slug,
  current,
  workspaces,
  email,
}: {
  slug: string;
  current: { name: string; slug: string; plan: string };
  workspaces: { name: string; slug: string }[];
  email?: string;
}) {
  const base = "/w";
  void slug;
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <WorkspaceSwitcher current={current} workspaces={workspaces} />
      <QuickCapture slug={slug} />
      <nav className="flex-1 space-y-4 overflow-y-auto pt-1">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.section && <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-faint">{group.section}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  href={`${base}${item.path}`}
                  exact={item.exact}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                  activeClassName="bg-surface-2 !text-fg font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-line pt-3">
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{email}</span>
        <form action={signOut}>
          <button type="submit" className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-fg" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
