"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { PageInfo } from "@/core/pagination";

export function ServerPagination({ page, pageSize, total }: PageInfo) {
  const [pending, startTransition] = useTransition();
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({
      shallow: false,
      scroll: false,
      startTransition,
    }),
  );
  const count = Math.ceil(total / pageSize);
  return (
    <nav
      aria-label="Table pagination"
      aria-busy={pending}
      className="flex items-center justify-between gap-4"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Page {count ? page : 0} of {count} · {total} records
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || page >= count}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
