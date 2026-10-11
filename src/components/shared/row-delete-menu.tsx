"use client";
import { MoreHorizontal, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { ActionState } from "@/core/action-result";
import { isNavigationSignal } from "./form/navigation-signal";

/**
 * Row actions column control: a ghost "more" button whose menu holds one
 * destructive item, confirmed in a dialog before the server action runs.
 */
export function RowDeleteMenu({
  rowLabel,
  itemLabel,
  title,
  description,
  run,
}: {
  /** Names the row for assistive tech, e.g. "Asha Rao". */
  rowLabel: string;
  /** Menu item and confirm button text, e.g. "Remove member". */
  itemLabel: string;
  title: string;
  description: string;
  run: () => Promise<ActionState>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await run();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.message) toast.success(result.message);
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${rowLabel}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setOpen(true)}
          >
            <Trash2 />
            {itemLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {pending && <Spinner data-icon="inline-start" />}
              {itemLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
