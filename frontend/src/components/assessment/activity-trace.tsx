"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, Loader2Icon } from "lucide-react";
import type { TraceEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ActivityTrace({
  trace,
  revealedCount,
  isLive,
}: {
  trace: TraceEntry[];
  revealedCount: number;
  isLive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visible = trace.slice(0, revealedCount);

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="font-heading text-sm font-semibold">Activity</span>
        <span className="text-xs text-muted-foreground">
          {isLive ? `${visible.length} of ${trace.length} tool calls` : `${trace.length} tool call${trace.length === 1 ? "" : "s"}`}
        </span>
        <ChevronDownIcon className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="space-y-1.5 border-t border-border/60 px-4 py-3">
          {visible.map((entry, i) => (
            <motion.li
              key={`${entry.tool_name}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 text-xs"
            >
              {entry.error ? (
                <CircleAlertIcon className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
              ) : (
                <CircleCheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <span className="font-mono text-muted-foreground">{entry.tool_name}</span>
              <span className="truncate text-foreground/80">{entry.error ?? entry.result_summary}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                {entry.duration_ms.toFixed(0)}ms
              </span>
            </motion.li>
          ))}
          {isLive && visible.length < trace.length && (
            <li className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              Running…
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
