import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { type StatusTone, statusLabel, statusTone } from "./status-badge-tone";

const statusBadge = cva(
  "inline-flex h-5.5 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-tag-neutral-border bg-tag-neutral text-tag-neutral-fg",
        blue: "border-tag-blue-border bg-tag-blue text-tag-blue-fg",
        purple: "border-tag-purple-border bg-tag-purple text-tag-purple-fg",
        green: "border-tag-green-border bg-tag-green text-tag-green-fg",
        amber: "border-tag-amber-border bg-tag-amber text-tag-amber-fg",
        red: "border-tag-red-border bg-tag-red text-tag-red-fg",
        teal: "border-tag-teal-border bg-tag-teal text-tag-teal-fg",
      } satisfies Record<StatusTone, string>,
    },
  },
);

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  /** Enum value such as `PENDING_APPROVAL`; also used to pick the tone. */
  status: string;
  /** Overrides the generated sentence-case label. */
  label?: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        statusBadge({ tone: tone ?? statusTone(status) }),
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label ?? statusLabel(status)}
    </span>
  );
}
