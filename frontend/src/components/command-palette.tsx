"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getClaimsQueue } from "@/lib/api";
import type { ClaimQueueItem } from "@/lib/types";
import { formatSaDate } from "@/lib/status";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [claims, setClaims] = useState<ClaimQueueItem[] | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    getClaimsQueue()
      .then((res) => setClaims(res.claims))
      .catch(() => setClaims([]));
  }, [open]);

  function go(claimId: string) {
    onOpenChange(false);
    router.push(`/assessments/${claimId}`);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a claim by ID or customer name…" />
      <CommandList>
        <CommandEmpty>
          {claims === null ? "Loading claims…" : "No matching claims."}
        </CommandEmpty>
        <CommandGroup heading="Claims">
          {claims?.map((claim) => (
            <CommandItem
              key={claim.claim_id}
              value={`${claim.claim_id} ${claim.customer_name}`}
              onSelect={() => go(claim.claim_id)}
            >
              <span className="font-mono text-xs text-muted-foreground">{claim.claim_id}</span>
              <span className="flex-1">{claim.customer_name}</span>
              <span className="text-xs text-muted-foreground">{formatSaDate(claim.incident_date)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
