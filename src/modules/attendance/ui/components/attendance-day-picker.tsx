"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useTransition } from "react";
import { DatePicker } from "@/components/shared/date-picker/date-picker";
import {
  fromDateValue,
  toDateValue,
} from "@/components/shared/date-picker/date-value";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";

/** Day switcher for the attendance sheet; the day lives in `?date=`. */
export function AttendanceDayPicker({ day }: { day: string }) {
  const [pending, startTransition] = useTransition();
  const [, setDate] = useQueryState(
    "date",
    parseAsString.withOptions({
      shallow: false,
      scroll: false,
      history: "replace",
      startTransition,
    }),
  );
  const shift = (days: number) => {
    const date = fromDateValue(day);
    if (!date) return;
    date.setDate(date.getDate() + days);
    void setDate(toDateValue(date));
  };
  return (
    <div className="flex items-center gap-2">
      {pending && <Spinner className="text-muted-foreground" />}
      <ButtonGroup>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => shift(-1)}
        >
          <ChevronLeft />
        </Button>
        <DatePicker
          aria-label="Attendance date"
          value={day}
          onChange={(next) => next && void setDate(next)}
          clearable={false}
          className="w-auto min-w-40"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next day"
          onClick={() => shift(1)}
        >
          <ChevronRight />
        </Button>
      </ButtonGroup>
    </div>
  );
}
