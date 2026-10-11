"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { isNavigationSignal } from "@/components/shared/form/navigation-signal";
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
import { submitBillAction } from "../../server/actions";

/** Header action: confirms, then submits the draft bill for approval. */
export function SubmitBillButton({
  org,
  billId,
  code,
}: {
  org: string;
  billId: string;
  code: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await submitBillAction(org, { id: billId });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Bill submitted for approval.");
        setOpen(false);
        router.refresh();
      } catch (error) {
        if (isNavigationSignal(error)) {
          setOpen(false);
          return;
        }
        toast.error("Unable to submit. Please try again.");
      }
    });
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Submit for approval
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit {code} for approval?</DialogTitle>
            <DialogDescription>
              The bill can no longer be edited once it is submitted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
