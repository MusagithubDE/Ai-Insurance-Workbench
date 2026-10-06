"use client";

import { useId, useState } from "react";
import { CheckIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, submitFeedback } from "@/lib/api";
import type { FeedbackVerdict } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FeedbackWidget({ runId, checkId }: { runId: string; checkId: string }) {
  const [verdict, setVerdict] = useState<FeedbackVerdict | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();

  if (submitted) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        Thanks — feedback recorded.
      </p>
    );
  }

  async function choose(next: FeedbackVerdict) {
    setVerdict(next);
    setError(null);
  }

  async function submit() {
    if (!verdict) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback(runId, checkId, verdict, note.trim() || undefined);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Was this check right?</span>
        <Button
          size="icon-xs"
          variant={verdict === "correct" ? "secondary" : "ghost"}
          aria-label="Mark this check as correct"
          aria-pressed={verdict === "correct"}
          onClick={() => choose("correct")}
        >
          <ThumbsUpIcon className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant={verdict === "incorrect" ? "secondary" : "ghost"}
          aria-label="Mark this check as incorrect"
          aria-pressed={verdict === "incorrect"}
          onClick={() => choose("incorrect")}
        >
          <ThumbsDownIcon className="size-3.5" />
        </Button>
      </div>
      {verdict && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={noteId} className="sr-only">
            Optional note about this feedback
          </label>
          <Input
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note…"
            maxLength={500}
            className="h-7 text-xs"
          />
          <Button size="sm" className="h-7 shrink-0" onClick={submit} disabled={submitting}>
            Send
          </Button>
        </div>
      )}
      {error && (
        <p className={cn("text-xs text-destructive")} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
