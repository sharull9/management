"use client";
import { type ComponentProps, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
export function Field({
  label,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input {...props} id={id} />
    </div>
  );
}
export function SelectField({
  label,
  children,
  className,
  ...props
}: ComponentProps<"select"> & { label: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        {...props}
        id={id}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
      >
        {children}
      </select>
    </div>
  );
}
