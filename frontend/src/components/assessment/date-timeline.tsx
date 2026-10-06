import { formatSaDate } from "@/lib/status";
import type { DateTimelineData } from "@/lib/evidence";
import { cn } from "@/lib/utils";

/** Visualises policy cover start/end against every known account of the
 * incident date on a single axis, so a date that falls outside the policy
 * period (or disagrees between sources) is immediately visible. */
export function DateTimeline({ data }: { data: DateTimelineData }) {
  const startMs = new Date(`${data.start}T00:00:00`).getTime();
  const endMs = new Date(`${data.end}T00:00:00`).getTime();
  const pointsMs = data.points.map((p) => new Date(`${p.iso}T00:00:00`).getTime());

  const lo = Math.min(startMs, ...pointsMs);
  const hi = Math.max(endMs, ...pointsMs);
  const span = Math.max(hi - lo, 1);
  const pad = span * 0.08;
  const axisLo = lo - pad;
  const axisHi = hi + pad;
  const pct = (ms: number) => ((ms - axisLo) / (axisHi - axisLo)) * 100;

  const distinctDates = new Set(data.points.map((p) => p.iso)).size > 1;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="relative mt-2 mb-7 h-1.5">
        <div
          className="absolute inset-y-0 rounded-full bg-primary/20"
          style={{ left: `${pct(startMs)}%`, right: `${100 - pct(endMs)}%` }}
        />
        <div className="absolute inset-y-0 w-full rounded-full border border-dashed border-border" />
        <TimelineMark pctPos={pct(startMs)} tone="neutral" label="Cover starts" date={data.start} align="start" />
        <TimelineMark pctPos={pct(endMs)} tone="neutral" label="Cover ends" date={data.end} align="end" />
        {data.points.map((p) => {
          const inRange = new Date(`${p.iso}T00:00:00`).getTime() >= startMs && new Date(`${p.iso}T00:00:00`).getTime() <= endMs;
          return (
            <TimelineMark
              key={p.evidenceId}
              pctPos={pct(new Date(`${p.iso}T00:00:00`).getTime())}
              tone={inRange ? "pass" : "fail"}
              label={p.label}
              date={p.iso}
              align="center"
              dot
            />
          );
        })}
      </div>
      <p className={cn("text-xs", distinctDates ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
        {distinctDates
          ? "Sources disagree on the incident date — see the conflicting markers above."
          : "All sources agree on the incident date."}
      </p>
    </div>
  );
}

function TimelineMark({
  pctPos,
  tone,
  label,
  date,
  align,
  dot,
}: {
  pctPos: number;
  tone: "pass" | "fail" | "neutral";
  label: string;
  date: string;
  align: "start" | "center" | "end";
  dot?: boolean;
}) {
  const toneDot =
    tone === "pass"
      ? "bg-emerald-500 ring-emerald-200 dark:ring-emerald-500/30"
      : tone === "fail"
        ? "bg-red-500 ring-red-200 dark:ring-red-500/30"
        : "bg-foreground/70 ring-border";
  const toneText = tone === "fail" ? "text-red-700 dark:text-red-400 font-medium" : "text-muted-foreground";

  return (
    <div
      className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1"
      style={{
        left: `${Math.min(Math.max(pctPos, 2), 98)}%`,
        transform: `translate(${align === "start" ? "0%" : align === "end" ? "-100%" : "-50%"}, -50%)`,
      }}
    >
      <span className={cn("block size-3 rounded-full ring-4", toneDot)} aria-hidden={!dot} />
      <span className={cn("absolute top-4 w-max text-center text-[11px] leading-tight", toneText)}>
        {label}
        <br />
        <span className="tabular-nums">{formatSaDate(date)}</span>
      </span>
    </div>
  );
}
