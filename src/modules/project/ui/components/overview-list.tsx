import Link from "next/link";
import type { ReactNode } from "react";

type OverviewRow = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  href?: string;
  /** Share of the largest row, 0–100, drawn as a bar under the label. */
  share?: number;
};

/** Short label/value rows for overview panels, with an optional share bar. */
export function OverviewList({
  rows,
  empty,
}: {
  rows: OverviewRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }
  return (
    <ul className="-my-2 divide-y">
      {rows.map((row) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {row.value}
              </span>
            </div>
            {row.share !== undefined && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(2, row.share)}%` }}
                />
              </div>
            )}
          </>
        );
        return (
          <li key={row.id} className="text-sm">
            {row.href ? (
              <Link
                href={row.href}
                className="-mx-2 block rounded-md px-2 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                {body}
              </Link>
            ) : (
              <div className="py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
