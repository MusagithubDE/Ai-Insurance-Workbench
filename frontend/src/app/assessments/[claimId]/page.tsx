"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon, RotateCcwIcon, ServerCrashIcon } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createAssessment, streamAssessmentEvents } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import type { AssessmentResponse, SseEvent } from "@/lib/types";
import { ClaimHeader } from "@/components/assessment/claim-header";
import { CheckRow } from "@/components/assessment/check-row";
import { SummaryCard } from "@/components/assessment/summary-card";
import { ActivityTrace } from "@/components/assessment/activity-trace";
import { NextActionCard } from "@/components/assessment/next-action-card";
import { EvidencePanel } from "@/components/assessment/evidence-panel";

export default function AssessmentPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const router = useRouter();
  const { role } = useRole();

  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<string | null>(null);
  const closeStream = useRef<(() => void) | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state before (re-)fetching on claim/role change
    setAssessment(null);
    setError(null);
    setEvents([]);
    setStreamDone(false);
    closeStream.current?.();

    createAssessment(claimId, role)
      .then((res) => {
        setAssessment(res);
        closeStream.current = streamAssessmentEvents(res.run_id, {
          onEvent: (event) => setEvents((prev) => [...prev, event]),
          onDone: () => setStreamDone(true),
          onError: () => setStreamDone(true),
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Something went wrong preparing this assessment.");
      });

    return () => closeStream.current?.();
  }, [claimId, role, reloadKey]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 p-16 text-center">
        <ServerCrashIcon className="size-8 text-destructive" />
        <p className="font-medium">Couldn&apos;t prepare this claim</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeftIcon className="size-4" /> Back to queue
          </Button>
          <Button onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCcwIcon className="size-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return <AssessmentSkeleton />;
  }

  const revealedToolCalls = streamDone
    ? assessment.trace.length
    : events.filter((e) => e.kind === "tool_call").length;
  const revealedCheckIds = new Set(
    streamDone ? assessment.checks.map((c) => c.check_id) : events.filter((e) => e.kind === "check").map((e) => e.name)
  );
  const isLive = !streamDone;
  const visibleChecks = assessment.checks.filter((c) => revealedCheckIds.has(c.check_id));

  return (
    <div className="flex flex-col gap-4 p-6">
      <Button variant="ghost" size="sm" className="w-fit gap-1.5 text-muted-foreground" onClick={() => router.push("/")}>
        <ArrowLeftIcon className="size-3.5" /> Back to queue
      </Button>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <ClaimHeader claimId={assessment.claim_id} status={assessment.status} evidence={assessment.evidence} />
          <NextActionCard
            status={assessment.status}
            nextAction={assessment.next_action}
            checks={assessment.checks}
            draftMessages={assessment.draft_messages}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-heading text-sm font-semibold">Readiness checklist</h2>
              {isLive && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
                  <Loader2Icon className="size-3 animate-spin" aria-hidden="true" /> running checks…
                </span>
              )}
            </div>
            {assessment.checks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {assessment.failed_tool
                  ? `No checks could run — the ${assessment.failed_tool} tool did not respond.`
                  : "No checks were run for this claim."}
              </div>
            ) : (
              <ul className="flex flex-col gap-2" aria-live="polite" aria-busy={isLive}>
                <AnimatePresence initial={false}>
                  {visibleChecks.map((check) => (
                    <CheckRow
                      key={check.check_id}
                      runId={assessment.run_id}
                      check={check}
                      evidence={assessment.evidence}
                      onFocusEvidence={setHighlightedEvidenceId}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          <SummaryCard summary={assessment.summary} summaryStatus={assessment.summary_status} />

          <ActivityTrace trace={assessment.trace} revealedCount={revealedToolCalls} isLive={isLive} />

          <div className="xl:hidden">
            <EvidencePanel evidence={assessment.evidence} highlightedId={highlightedEvidenceId} />
          </div>
        </div>

        <div className="hidden xl:block xl:sticky xl:top-4 xl:h-[calc(100dvh-7rem)]">
          <EvidencePanel evidence={assessment.evidence} highlightedId={highlightedEvidenceId} />
        </div>
      </div>
    </div>
  );
}

function AssessmentSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-6 w-28" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <Skeleton className="hidden h-96 rounded-xl xl:block" />
      </div>
    </div>
  );
}
