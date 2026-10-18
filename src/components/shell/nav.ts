import {
  ChartColumn,
  Bot,
  Briefcase,
  CalendarCheck,
  SquareCheckBig,
  FileText,
  FolderKanban,
  Gavel,
  Grid2x2,
  Handshake,
  Hourglass,
  LayoutDashboard,
  Settings,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string; // relative to /w/[slug]
  icon: LucideIcon;
  exact?: boolean;
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "",
    items: [
      { label: "Command Center", path: "", icon: LayoutDashboard, exact: true },
      { label: "Copilot", path: "/copilot", icon: Bot },
      { label: "Focus", path: "/focus", icon: Grid2x2 },
      { label: "Weekly review", path: "/review", icon: CalendarCheck },
    ],
  },
  {
    section: "Execution",
    items: [
      { label: "Tasks", path: "/tasks", icon: SquareCheckBig },
      { label: "Projects", path: "/projects", icon: FolderKanban },
      { label: "Goals", path: "/goals", icon: Target },
    ],
  },
  {
    section: "People",
    items: [
      { label: "Team", path: "/team", icon: Users },
      { label: "Waiting on", path: "/delegation", icon: Hourglass },
      { label: "Meetings", path: "/meetings", icon: Briefcase },
      { label: "Decisions", path: "/decisions", icon: Gavel },
    ],
  },
  {
    section: "Growth & money",
    items: [
      { label: "Pipeline", path: "/pipeline", icon: Handshake },
      { label: "Finance", path: "/finance", icon: Wallet, exact: true },
      { label: "Invoices", path: "/finance/invoices", icon: FileText },
      { label: "KPIs", path: "/kpis", icon: ChartColumn },
    ],
  },
  {
    section: "",
    items: [{ label: "Settings", path: "/settings", icon: Settings }],
  },
];
