"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ArrowRightIcon, SearchIcon, ServerCrashIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { ApiError, getClaimsQueue } from "@/lib/api";
import type { AssessmentStatus, ClaimQueueItem } from "@/lib/types";
import { ASSESSMENT_STATUS_VISUAL, formatSaDate } from "@/lib/status";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | AssessmentStatus | "not_run";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_run", label: "Not yet run" },
  { value: "READY_FOR_HUMAN_REVIEW", label: "Ready" },
  { value: "REVIEW_REQUIRED", label: "Review required" },
  { value: "INCOMPLETE", label: "Incomplete" },
];

export default function QueuePage() {
  const router = useRouter();
  const [claims, setClaims] = useState<ClaimQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  function load() {
    setError(null);
    setClaims(null);
    getClaimsQueue()
      .then((res) => setClaims(res.claims))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Something went wrong loading the queue.");
      });
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; load() resets state before the request
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!claims) return [];
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      const matchesSearch =
        !q ||
        c.claim_id.toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q) ||
        c.vehicle_registration.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "not_run" ? c.last_run_status === null : c.last_run_status === filter);
      return matchesSearch && matchesFilter;
    });
  }, [claims, search, filter]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Claims queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a claim to prepare its readiness pack before human review.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by claim, customer or plate…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.value
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <ServerCrashIcon className="size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t reach the backend</p>
            <p className="text-destructive/80">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {!error && claims === null && <QueueSkeleton />}

      {!error && claims !== null && claims.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <AlertCircleIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No claims in the queue</p>
          <p className="text-sm text-muted-foreground">Synthetic fixtures haven&apos;t been seeded yet.</p>
        </div>
      )}

      {!error && claims !== null && claims.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Claim</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Incident date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((claim) => (
                <TableRow key={claim.claim_id}>
                  <TableCell>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {claim.claim_id}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{claim.customer_name}</TableCell>
                  <TableCell className="tabular-nums">{formatSaDate(claim.incident_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{claim.vehicle_registration}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{claim.age_days}d</TableCell>
                  <TableCell>
                    {claim.last_run_status ? (
                      <StatusPill status={claim.last_run_status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Not yet run</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => router.push(`/assessments/${claim.claim_id}`)}
                    >
                      Prepare review
                      <ArrowRightIcon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                    No claims match your search or filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: AssessmentStatus }) {
  const visual = ASSESSMENT_STATUS_VISUAL[status];
  const Icon = visual.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 border", visual.text, visual.bg, visual.border)}>
      <Icon className="size-3" />
      {visual.label}
    </Badge>
  );
}

function QueueSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-7 w-28 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
