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
import { deleteAllocationAction } from "../../server/actions";
import { deleteLogAction } from "../../server/log-actions";

export function DeleteAssetRecord({
  org,
  id,
  kind,
}: {
  org: string;
  id: string;
  kind: "ALLOCATION" | "TRIP" | "USAGE" | "FUEL";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = kind === "ALLOCATION" ? "allocation" : kind.toLowerCase();
  const remove = () =>
    startTransition(async () => {
      const result =
        kind === "ALLOCATION"
          ? await deleteAllocationAction(org, { id })
          : await deleteLogAction(org, { id, kind });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Delete {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this {label}?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {pending && <Spinner data-icon="inline-start" />}Delete {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
