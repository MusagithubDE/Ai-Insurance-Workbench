import { Card, CardContent } from "@/components/ui/card";
import { firstByCategory } from "@/lib/evidence";
import { ASSESSMENT_STATUS_VISUAL, formatSaDate } from "@/lib/status";
import type { AssessmentStatus, EvidenceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClaimHeader({
  claimId,
  status,
  evidence,
}: {
  claimId: string;
  status: AssessmentStatus;
  evidence: EvidenceItem[];
}) {
  const claim = firstByCategory(evidence, "claim");
  const customer = firstByCategory(evidence, "customer");
  const policy = firstByCategory(evidence, "policy");
  const visual = ASSESSMENT_STATUS_VISUAL[status];
  const Icon = visual.icon;

  return (
    <Card className="gap-4 py-4">
      <CardContent className="flex flex-col gap-4 px-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{claimId}</p>
          <h1 className="font-heading text-lg font-semibold">{customer?.detail.name ?? "Unknown customer"}</h1>
          {claim && (
            <p className="text-sm text-muted-foreground">
              {claim.detail.claim_type?.replaceAll("_", " ")} · {claim.detail.vehicle_registration} · incident{" "}
              {formatSaDate(claim.detail.incident_date)}
            </p>
          )}
        </div>

        {policy && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Policy</dt>
            <dd className="text-right font-mono">{policy.evidence_id}</dd>
            <dt className="text-muted-foreground">Cover type</dt>
            <dd className="text-right capitalize">{String(policy.detail.cover_type).replaceAll("_", " ")}</dd>
            <dt className="text-muted-foreground">Cover period</dt>
            <dd className="text-right tabular-nums">
              {formatSaDate(policy.detail.cover_start_date)} – {formatSaDate(policy.detail.cover_end_date)}
            </dd>
          </dl>
        )}

        <div
          className={cn("flex items-start gap-2.5 rounded-lg border p-3", visual.bg, visual.border)}
          role="status"
        >
          <Icon className={cn("mt-0.5 size-4.5 shrink-0", visual.text)} aria-hidden="true" />
          <p className={cn("text-sm font-medium", visual.text)}>{visual.label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
