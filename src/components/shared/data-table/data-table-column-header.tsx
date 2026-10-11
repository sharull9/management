"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: {
  column: Column<TData, TValue>;
  title: string;
}) {
  "use no memo";
  if (!column.getCanSort()) return <span>{title}</span>;
  const sorted = column.getIsSorted();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={column.getToggleSortingHandler()}
      aria-label={`${title}: ${sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "unsorted"}. Change sorting`}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp data-icon="inline-end" />
      ) : sorted === "desc" ? (
        <ArrowDown data-icon="inline-end" />
      ) : (
        <ArrowUpDown data-icon="inline-end" />
      )}
    </Button>
  );
}
