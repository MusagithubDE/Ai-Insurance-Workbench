"use client";

import { useState } from "react";
import { CheckIcon, CircleAlertIcon, CopyIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { expectsCustomerDraft } from "@/lib/status";
import type { AssessmentStatus, CheckResult, DraftMessages } from "@/lib/types";

export function NextActionCard({
  status,
  nextAction,
  checks,
  draftMessages,
}: {
  status: AssessmentStatus;
  nextAction: string;
  checks: CheckResult[];
  draftMessages: DraftMessages | null;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [copied, setCopied] = useState<"sms" | "email" | null>(null);

  async function copy(text: string, which: "sms" | "email") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
    } catch {
      // clipboard unavailable (e.g. insecure context) -- nothing to recover
    }
  }

  const draftExpected = status === "REVIEW_REQUIRED" && expectsCustomerDraft(checks);

  return (
    <Card className="gap-3 py-4">
      <CardHeader>
        <CardTitle>Next action</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground/90">{nextAction}</p>
        <Button
          size="sm"
          variant={reviewed ? "secondary" : "outline"}
          className="w-fit gap-1.5"
          onClick={() => setReviewed((v) => !v)}
        >
          <CheckIcon className="size-3.5" />
          {reviewed ? "Marked as reviewed (this session)" : "Mark as reviewed"}
        </Button>

        {draftMessages && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Draft — assessor must review before sending
            </p>
            <Tabs defaultValue="sms">
              <TabsList>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
              <TabsContent value="sms" className="flex flex-col gap-2 pt-2">
                <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-sm whitespace-pre-wrap">
                  {draftMessages.sms}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit gap-1.5"
                  onClick={() => copy(draftMessages.sms, "sms")}
                >
                  {copied === "sms" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                  {copied === "sms" ? "Copied" : "Copy"}
                </Button>
              </TabsContent>
              <TabsContent value="email" className="flex flex-col gap-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground">{draftMessages.email_subject}</p>
                <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-sm whitespace-pre-wrap">
                  {draftMessages.email_body}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit gap-1.5"
                  onClick={() => copy(`${draftMessages.email_subject}\n\n${draftMessages.email_body}`, "email")}
                >
                  {copied === "email" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                  {copied === "email" ? "Copied" : "Copy"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {!draftMessages && draftExpected && (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Couldn&apos;t generate a draft customer message — the model was unavailable. The checklist above
              already reflects the full, code-decided outcome.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
