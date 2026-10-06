import type { EvidenceCategory, EvidenceItem } from "@/lib/types";

export function byCategory(evidence: EvidenceItem[], category: EvidenceCategory): EvidenceItem[] {
  return evidence.filter((e) => e.category === category);
}

export function firstByCategory(evidence: EvidenceItem[], category: EvidenceCategory): EvidenceItem | undefined {
  return evidence.find((e) => e.category === category);
}

export function byId(evidence: EvidenceItem[], id: string): EvidenceItem | undefined {
  return evidence.find((e) => e.evidence_id === id);
}

export interface DateTimelinePoint {
  label: string;
  iso: string;
  evidenceId: string;
}

export interface DateTimelineData {
  policyId: string;
  start: string;
  end: string;
  points: DateTimelinePoint[];
}

/** Builds the policy-start/end vs incident-date comparison used by the
 * policy_in_force and incident_date_consistency checks. Returns null when
 * the evidence bundle doesn't carry enough to compare (e.g. INCOMPLETE runs). */
export function buildDateTimeline(evidence: EvidenceItem[]): DateTimelineData | null {
  const policy = firstByCategory(evidence, "policy");
  const claim = firstByCategory(evidence, "claim");
  if (!policy || !claim) return null;

  const points: DateTimelinePoint[] = [
    { label: "Claim form", iso: claim.detail.incident_date, evidenceId: claim.evidence_id },
  ];

  for (const doc of byCategory(evidence, "document")) {
    if (doc.detail.type === "police_report" && doc.detail.fields?.incident_date) {
      points.push({ label: "Police report", iso: doc.detail.fields.incident_date, evidenceId: doc.evidence_id });
    }
  }

  return {
    policyId: policy.evidence_id,
    start: policy.detail.cover_start_date,
    end: policy.detail.cover_end_date,
    points,
  };
}
