"use client";

import { Eye, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { OverlayCloseContext } from "./overlay-context";

const widths = {
  md: "data-[side=right]:sm:max-w-md",
  lg: "data-[side=right]:sm:max-w-xl",
  xl: "data-[side=right]:sm:max-w-3xl",
};

type SideSheetProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  width?: keyof typeof widths;
  trigger: ReactNode;
  triggerVariant?: "default" | "outline" | "ghost" | "link" | "secondary";
  triggerSize?: "default" | "sm" | "xs";
  triggerIcon?: "plus" | "eye" | "none";
  triggerClassName?: string;
};

/**
 * A right-hand drawer opened from a button. Forms rendered inside close the
 * drawer automatically after a successful save (see OverlayCloseContext).
 */
export function SideSheet({
  title,
  description,
  children,
  width = "lg",
  trigger,
  triggerVariant = "default",
  triggerSize = "default",
  triggerIcon = "none",
  triggerClassName,
}: SideSheetProps) {
  const [open, setOpen] = useState(false);
  const Icon =
    triggerIcon === "plus" ? Plus : triggerIcon === "eye" ? Eye : null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          className={triggerClassName}
        >
          {Icon && <Icon data-icon="inline-start" />}
          {trigger}
        </Button>
      </SheetTrigger>
      <SheetContent className={cn("w-full gap-0", widths[width])}>
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <OverlayCloseContext value={() => setOpen(false)}>
            {children}
          </OverlayCloseContext>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Primary "New …" button that opens a create form in a drawer. */
export function CreateSheet({
  label,
  title,
  description,
  children,
  width,
}: {
  label: string;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  width?: keyof typeof widths;
}) {
  return (
    <SideSheet
      title={title ?? label}
      description={description}
      trigger={label}
      triggerIcon="plus"
      width={width}
    >
      {children}
    </SideSheet>
  );
}

/** Compact row action that opens details in a drawer. */
export function DetailSheet({
  label = "View",
  title,
  description,
  children,
  width = "md",
}: {
  label?: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  width?: keyof typeof widths;
}) {
  return (
    <SideSheet
      title={title}
      description={description}
      trigger={label}
      triggerVariant="outline"
      triggerSize="sm"
      width={width}
    >
      {children}
    </SideSheet>
  );
}
