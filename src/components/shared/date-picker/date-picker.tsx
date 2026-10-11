"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { type Ref, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fromDateValue, toDateValue } from "./date-value";

export type DatePickerProps = {
  /** `YYYY-MM-DD`, or an empty string when blank. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  clearable?: boolean;
  id?: string;
  name?: string;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
};

export function DatePicker({
  value,
  onChange,
  onBlur,
  min,
  max,
  disabled,
  placeholder = "Pick a date",
  clearable = true,
  className,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromDateValue(value);
  const minDate = fromDateValue(min);
  const maxDate = fromDateValue(max);
  const choose = (date?: Date) => {
    onChange(date ? toDateValue(date) : "");
    setOpen(false);
  };
  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          {...props}
          type="button"
          variant="outline"
          disabled={disabled}
          onBlur={onBlur}
          data-empty={!selected}
          className={cn(
            "w-full justify-start font-normal tabular-nums data-[empty=true]:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          <span className="truncate">
            {selected ? format(selected, "d MMM yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate ?? maxDate}
          onSelect={choose}
          captionLayout="dropdown"
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          autoFocus
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => choose(new Date())}
          >
            Today
          </Button>
          {clearable && selected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => choose(undefined)}
            >
              <X data-icon="inline-start" />
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
