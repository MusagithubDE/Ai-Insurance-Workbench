"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isK = event.key.toLowerCase() === "k";
      if (isK && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar onOpenCommandPalette={() => setPaletteOpen(true)} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
