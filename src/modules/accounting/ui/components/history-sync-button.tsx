"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyTemplatesAction } from "../../server/actions";
import { syncHistoryBatchAction } from "../../server/history-actions";
import type { HistoryCursor } from "../../server/history-service";

export function HistorySyncButton({ org }: { org: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<HistoryCursor | null>(null);
  const [processed, setProcessed] = useState(0);
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            let nextCursor = cursor;
            if (!cursor) setProcessed(0);
            try {
              while (true) {
                const result = await syncHistoryBatchAction(org, {
                  cursor: nextCursor,
                });
                if (!("sources" in result)) {
                  const message = `${result.error ?? "Synchronization stopped."} Retry to continue from the last completed batch.`;
                  setError(message);
                  toast.error(message);
                  return;
                }
                setProcessed((count) => count + result.sources);
                nextCursor = result.nextCursor;
                setCursor(nextCursor);
                if (result.done) break;
              }
              toast.success("Accounting history synchronized.");
              router.refresh();
            } catch {
              const message =
                "Synchronization stopped. Retry to continue from the last completed batch.";
              setError(message);
              toast.error(message);
            }
          });
        }}
      >
        {pending
          ? "Synchronizing…"
          : cursor
            ? "Resume accounting history"
            : "Synchronize accounting history"}
      </Button>
      {(pending || processed > 0) && (
        <output
          className="block text-sm text-muted-foreground"
          aria-live="polite"
        >
          {processed} sources synchronized.
        </output>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ApplyTemplatesButton({ org }: { org: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await applyTemplatesAction(org, {});
            if (result?.error) {
              setError(result.error);
              toast.error(result.error);
            } else {
              toast.success("Account templates applied.");
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Applying…" : "Apply account templates"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
