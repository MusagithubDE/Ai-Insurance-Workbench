"use client";

import { useState } from "react";
import { CheckCircle2Icon, Loader2Icon, PlayIcon, ServerCrashIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, runEvaluationSuite } from "@/lib/api";
import type { EvaluationResponse } from "@/lib/types";
import { ASSESSMENT_STATUS_VISUAL } from "@/lib/status";
import { cn } from "@/lib/utils";

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-border p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-xl font-semibold tabular-nums", tone === "warn" && "text-amber-700 dark:text-amber-400")}>
        {value}
      </p>
    </div>
  );
}

function StatusLabel({ status }: { status: keyof typeof ASSESSMENT_STATUS_VISUAL }) {
  const visual = ASSESSMENT_STATUS_VISUAL[status];
  const Icon = visual.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", visual.text)}>
      <Icon className="size-3.5" />
      {visual.label}
    </span>
  );
}

export default function EvaluationsPage() {
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      setResult(await runEvaluationSuite());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The evaluation run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Evaluations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Runs all 8 synthetic scenarios end-to-end against the live model and compares the outcome to each
          fixture&apos;s expected status.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={running} className="gap-1.5">
          {running ? <Loader2Icon className="size-4 animate-spin" /> : <PlayIcon className="size-4" />}
          {running ? "Running… (calls the model live, can take a minute)" : "Run evaluation suite"}
        </Button>
        {result && !running && (
          <span className="text-xs text-muted-foreground">
            Last run {new Date(result.run_at).toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <ServerCrashIcon className="size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">The evaluation run failed</p>
            <p className="text-destructive/80">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={run}>
            Retry
          </Button>
        </div>
      )}

      {running && !result && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {!result && !running && !error && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <PlayIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No evaluation run yet</p>
          <p className="text-sm text-muted-foreground">Run the suite to see accuracy and citation metrics.</p>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4" aria-live="polite">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiTile label="Accuracy" value={pct(result.metrics.accuracy)} />
            <KpiTile label="Citation validity" value={pct(result.metrics.citation_validity_rate)} />
            <KpiTile
              label="Missed conflicts"
              value={String(result.metrics.missed_conflicts)}
              tone={result.metrics.missed_conflicts > 0 ? "warn" : undefined}
            />
            <KpiTile
              label="False review-required"
              value={String(result.metrics.false_review_required_count)}
              tone={result.metrics.false_review_required_count > 0 ? "warn" : undefined}
            />
            <KpiTile label="Avg run time" value={`${(result.metrics.avg_run_time_ms / 1000).toFixed(1)}s`} />
            <KpiTile label="Avg tool calls" value={result.metrics.avg_tool_calls.toFixed(1)} />
          </div>

          <p className="font-mono text-xs text-muted-foreground">
            model: {result.model_tag} · commit: {result.git_commit} · dataset: {result.dataset_version}
          </p>

          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Scenario</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Run time</TableHead>
                  <TableHead className="text-right">Tool calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.scenarios.map((s) => (
                  <TableRow key={s.claim_id}>
                    <TableCell className="text-xs text-muted-foreground">{s.scenario.replaceAll("_", " ")}</TableCell>
                    <TableCell>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{s.claim_id}</span>
                    </TableCell>
                    <TableCell>
                      <StatusLabel status={s.expected_status} />
                    </TableCell>
                    <TableCell>
                      <StatusLabel status={s.actual_status} />
                    </TableCell>
                    <TableCell>
                      {s.passed ? (
                        <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle2Icon className="size-3" />
                          Pass
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                          <XCircleIcon className="size-3" />
                          Fail
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {(s.run_time_ms / 1000).toFixed(1)}s
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{s.tool_call_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
