"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDownIcon } from "lucide-react";
import { CHECK_STATUS_VISUAL } from "@/lib/status";
import { buildDateTimeline } from "@/lib/evidence";
import type { CheckResult, EvidenceItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DateTimeline } from "@/components/assessment/date-timeline";
import { FeedbackWidget } from "@/components/assessment/feedback-widget";

const TIMELINE_CHECKS = new Set(["policy_in_force", "incident_date_consistency"]);

export function CheckRow({
  runId,
  check,
  evidence,
  onFocusEvidence,
}: {
  runId: string;
  check: CheckResult;
  evidence: EvidenceItem[];
  onFocusEvidence: (evidenceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const visual = CHECK_STATUS_VISUAL[check.status];
  const Icon = visual.icon;
  const timeline = TIMELINE_CHECKS.has(check.check_id) ? buildDateTimeline(evidence) : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("rounded-lg border", visual.border)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", visual.bg)}
      >
        <Icon className={cn("size-4.5 shrink-0", visual.text)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{check.label}</p>
          <p className="truncate text-xs text-muted-foreground">{check.reason}</p>
        </div>
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          <p className="text-sm text-foreground/90">{check.reason}</p>
          {timeline && <DateTimeline data={timeline} />}
          {check.evidence_ids.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {check.evidence_ids.map((id) => (
                <button
                  key={id}
                  onClick={() => onFocusEvidence(id)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {id}
                </button>
              ))}
            </div>
          )}
          <FeedbackWidget runId={runId} checkId={check.check_id} />
        </div>
      )}
    </motion.li>
  );
}
