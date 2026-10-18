import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { getWorkspace, listMyWorkspaces } from "@/lib/workspace";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ workspace, user }, mine] = await Promise.all([getWorkspace(slug), listMyWorkspaces()]);
  const current = { name: workspace.name, slug: workspace.slug, plan: workspace.plan };
  const workspaces = mine.map((m) => ({ name: m.workspace.name, slug: m.workspace.slug }));
  const sidebar = <Sidebar slug={slug} current={current} workspaces={workspaces} email={user.email} />;

  return (
    <div className="min-h-screen lg:flex">
      <MobileNav title={workspace.name}>{sidebar}</MobileNav>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-bg lg:block">{sidebar}</aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
