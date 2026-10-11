import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTile = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  href?: string;
};

/** A row of KPI tiles joined into one surface, used on dashboards. */
export function StatTiles({
  stats,
  className,
}: {
  stats: StatTile[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border bg-border shadow-xs sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none",
        className,
      )}
    >
      {stats.map((stat) => {
        const body = (
          <>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {stat.icon && <stat.icon className="size-4 text-faint" />}
              {stat.label}
            </span>
            <span className="mt-2 block text-2xl font-semibold tracking-tight tabular-nums">
              {stat.value}
            </span>
            {stat.detail && (
              <span className="mt-1 block text-xs text-muted-foreground">
                {stat.detail}
              </span>
            )}
          </>
        );
        return stat.href ? (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-card p-5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            {body}
          </Link>
        ) : (
          <div key={stat.label} className="bg-card p-5">
            {body}
          </div>
        );
      })}
    </div>
  );
}
