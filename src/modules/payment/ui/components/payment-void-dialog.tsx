"use client";
import { useState } from "react";
import { OverlayCloseContext } from "@/components/shared/overlay/overlay-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VoidPaymentForm } from "./payment-actions-form";

/** Destructive header action; the reason form doubles as the confirmation. */
export function PaymentVoidDialog({
  org,
  id,
  code,
}: {
  org: string;
  id: string;
  code: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          Void payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void {code}?</DialogTitle>
          <DialogDescription>
            This reverses all allocations and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <OverlayCloseContext value={() => setOpen(false)}>
          <VoidPaymentForm org={org} id={id} />
        </OverlayCloseContext>
      </DialogContent>
    </Dialog>
  );
}
