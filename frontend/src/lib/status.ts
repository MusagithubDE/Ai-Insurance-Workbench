import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  CircleSlashIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import type { AssessmentStatus, CheckResult, CheckStatus } from "@/lib/types";

/** Mirrors backend/app/decisions.py DOCUMENT_RELATED_CHECKS -- checks a
 * customer-facing message could plausibly resolve. */
export const DOCUMENT_RELATED_CHECK_IDS = new Set(["required_documents", "police_report_present"]);

export function expectsCustomerDraft(checks: CheckResult[]): boolean {
  return checks.some((c) => (c.status === "fail" || c.status === "unknown") && DOCUMENT_RELATED_CHECK_IDS.has(c.check_id));
}

export interface StatusVisual {
  label: string;
  icon: LucideIcon;
  /** text + icon color */
  text: string;
  /** soft background for badges/rows */
  bg: string;
  /** border color for cards/rows */
  border: string;
}

export const CHECK_STATUS_VISUAL: Record<CheckStatus, StatusVisual> = {
  pass: {
    label: "Pass",
    icon: CheckCircle2Icon,
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/30",
  },
  fail: {
    label: "Fail",
    icon: XCircleIcon,
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/30",
  },
  unknown: {
    label: "Unknown",
    icon: CircleHelpIcon,
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/30",
  },
};

export const ASSESSMENT_STATUS_VISUAL: Record<AssessmentStatus, StatusVisual> = {
  READY_FOR_HUMAN_REVIEW: {
    label: "Ready for human review",
    icon: CheckCircle2Icon,
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/30",
  },
  REVIEW_REQUIRED: {
    label: "Review required",
    icon: AlertTriangleIcon,
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/30",
  },
  INCOMPLETE: {
    label: "Incomplete",
    icon: CircleSlashIcon,
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-500/30",
  },
};

export function formatZar(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("ZAR", "R");
}

export function formatSaDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
