import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Label/value pairs for drawers and detail panels. */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2.5 text-sm",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
