"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { ActionState } from "@/core/action-result";
import { changePurchaseOrderStatusAction } from "../../server/order-terminal-actions";

type TerminalAction = "CLOSE" | "CANCEL";

const actionDetails = {
  CLOSE: {
    label: "Close order",
    title: "Close this purchase order?",
    description:
      "The order will be closed and can no longer receive additional receipts.",
    variant: "outline",
  },
  CANCEL: {
    label: "Cancel order",
    title: "Cancel this purchase order?",
    description: "The order will be cancelled. This cannot be undone.",
    variant: "destructive",
  },
} as const;

export function OrderTerminalControls({
  org,
  id,
  actions,
}: {
  org: string;
  id: string;
  actions: TerminalAction[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<TerminalAction | null>(null);
  const [pending, startTransition] = useTransition();
  const details = selected ? actionDetails[selected] : null;

  function confirm() {
    if (!selected) return;
    const action = selected;
    startTransition(async () => {
      try {
        const result: ActionState = await changePurchaseOrderStatusAction(org, {
          id,
          action,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.message ?? `${actionDetails[action].label} successful.`,
        );
        setSelected(null);
        router.refresh();
      } catch {
        toast.error("Unable to update this purchase order. Please try again.");
      }
    });
  }

  return (
    <>
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant={actionDetails[action].variant}
          disabled={pending}
          onClick={() => setSelected(action)}
        >
          {actionDetails[action].label}
        </Button>
      ))}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !pending && !open && setSelected(null)}
      >
        {details && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{details.title}</DialogTitle>
              <DialogDescription>{details.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={pending}>
                  Keep order
                </Button>
              </DialogClose>
              <Button
                variant={details.variant}
                disabled={pending}
                onClick={confirm}
              >
                {pending && <Spinner data-icon="inline-start" />}
                {details.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
