"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  ClipboardListIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/role-context";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Queue", icon: ClipboardListIcon, match: (p: string) => p === "/" || p.startsWith("/assessments") },
  { href: "/evaluations", label: "Evaluations", icon: BarChart3Icon, match: (p: string) => p.startsWith("/evaluations") },
  { href: "/settings", label: "Settings", icon: Settings2Icon, match: (p: string) => p.startsWith("/settings") },
];

const ROLE_LABEL: Record<string, string> = {
  assessor: "Assessor",
  team_lead: "Team lead",
};

export function AppSidebar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const pathname = usePathname();
  const { role, setRole } = useRole();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <ShieldCheckIcon className="size-4.5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-heading text-sm font-semibold">Claims Workbench</span>
          <span className="text-xs text-muted-foreground">Claim Readiness Pack</span>
        </div>
      </div>

      <div className="px-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onOpenCommandPalette}
        >
          <SearchIcon className="size-4" />
          <span className="flex-1 text-left">Jump to claim</span>
          <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            Ctrl K
          </kbd>
        </Button>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-sidebar-border p-4">
        <Badge variant="outline" className="w-fit border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          Synthetic data
        </Badge>

        <div className="flex items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="flex-1 justify-start gap-2 px-2" />
              }
            >
              <div className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {ROLE_LABEL[role][0]}
              </div>
              <span className="text-sm">{ROLE_LABEL[role]}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Demo user</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRole("assessor")}>
                  Assessor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRole("team_lead")}>
                  Team lead
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
