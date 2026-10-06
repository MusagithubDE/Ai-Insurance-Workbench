import { CircleAlertIcon, SparklesIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SummaryStatus } from "@/lib/types";

export function SummaryCard({
  summary,
  summaryStatus,
}: {
  summary: string | null;
  summaryStatus: SummaryStatus;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <SparklesIcon className="size-4 text-primary" />
          AI-generated summary · cites evidence
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summaryStatus === "ready" && summary && (
          <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
        )}
        {summaryStatus === "not_generated" && (
          <p className="text-sm text-muted-foreground">
            No summary was generated because the automated checks could not run for this claim. The evidence
            gathered so far is shown above.
          </p>
        )}
        {summaryStatus === "unavailable" && (
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>Summary unavailable — the model did not return a valid response. Review the evidence directly.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
