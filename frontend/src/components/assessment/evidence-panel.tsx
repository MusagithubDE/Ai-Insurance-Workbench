"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EvidenceCategory, EvidenceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const RECORD_CATEGORIES = new Set(["claim", "customer", "policy", "billing", "claims_history"]);

function tabForCategory(category: EvidenceCategory): string {
  if (category === "document") return "documents";
  if (category === "policy_wording") return "wording";
  return "records";
}

function humanize(key: string) {
  return key.replaceAll("_", " ");
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.map((v) => renderValue(v)).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function EvidenceCard({
  item,
  highlighted,
}: {
  item: EvidenceItem;
  highlighted: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const entries = Object.entries(item.detail).filter(([, v]) => typeof v !== "object" || v === null);
  const nested = Object.entries(item.detail).filter(([, v]) => typeof v === "object" && v !== null);

  return (
    <div
      ref={ref}
      data-evidence-id={item.evidence_id}
      className={cn(
        "rounded-lg border p-3 transition-colors",
        highlighted ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{item.title}</p>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {item.evidence_id}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="capitalize text-muted-foreground">{humanize(key)}</dt>
            <dd className="truncate text-right tabular-nums">{renderValue(value)}</dd>
          </div>
        ))}
      </dl>
      {nested.map(([key, value]) => (
        <div key={key} className="mt-2 border-t border-border/60 pt-2">
          <p className="mb-1 text-xs font-medium capitalize text-muted-foreground">{humanize(key)}</p>
          <pre className="overflow-x-auto rounded bg-muted/60 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

export function EvidencePanel({
  evidence,
  highlightedId,
}: {
  evidence: EvidenceItem[];
  highlightedId: string | null;
}) {
  const records = evidence.filter((e) => RECORD_CATEGORIES.has(e.category));
  const documents = evidence.filter((e) => e.category === "document");
  const wording = evidence.filter((e) => e.category === "policy_wording");
  const [tab, setTab] = useState("records");

  useEffect(() => {
    if (!highlightedId) return;
    const item = evidence.find((e) => e.evidence_id === highlightedId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- switch tabs in response to an external click target
    if (item) setTab(tabForCategory(item.category));
  }, [highlightedId, evidence]);

  return (
    <div className="flex h-full flex-col">
      <h2 className="px-1 pb-3 font-heading text-sm font-semibold">Evidence</h2>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="records" className="flex-1">Records</TabsTrigger>
          <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
          <TabsTrigger value="wording" className="flex-1">Policy wording</TabsTrigger>
        </TabsList>
        <ScrollArea className="mt-3 min-h-0 flex-1">
          <TabsContent value="records" className="flex flex-col gap-2 pr-2">
            {records.length === 0 && <EmptyNote text="No records gathered yet." />}
            {records.map((item) => (
              <EvidenceCard key={item.evidence_id} item={item} highlighted={item.evidence_id === highlightedId} />
            ))}
          </TabsContent>
          <TabsContent value="documents" className="flex flex-col gap-2 pr-2">
            {documents.length === 0 && <EmptyNote text="No documents on this claim." />}
            {documents.map((item) => (
              <EvidenceCard key={item.evidence_id} item={item} highlighted={item.evidence_id === highlightedId} />
            ))}
          </TabsContent>
          <TabsContent value="wording" className="flex flex-col gap-2 pr-2">
            {wording.length === 0 && <EmptyNote text="No policy wording retrieved yet." />}
            {wording.map((item) => (
              <EvidenceCard key={item.evidence_id} item={item} highlighted={item.evidence_id === highlightedId} />
            ))}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{text}</p>;
}
