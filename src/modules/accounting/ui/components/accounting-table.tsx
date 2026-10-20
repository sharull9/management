import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";

export type AccountingColumn<Row> = {
  key: keyof Row;
  label: string;
  align?: "right";
};

export function AccountingTable<
  Row extends Record<string, ReactNode> & { id: string },
>({
  columns,
  rows,
  empty = "No posted activity yet.",
  href,
}: {
  columns: AccountingColumn<Row>[];
  rows: Row[];
  empty?: string;
  href?: (row: Row) => string | undefined;
}) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={`px-3 py-2 font-medium ${column.align === "right" ? "text-right" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, index) => {
            const target = href?.(row);
            return (
              <tr key={String(row.id ?? index)} className="hover:bg-muted/30">
                {columns.map((column, columnIndex) => (
                  <td
                    key={String(column.key)}
                    className={`whitespace-nowrap px-3 py-2.5 ${column.align === "right" ? "text-right tabular-nums" : ""}`}
                  >
                    {columnIndex === 0 && target ? (
                      <Link
                        className="font-medium underline-offset-4 hover:underline focus-visible:underline"
                        href={target}
                      >
                        {row[column.key]}
                      </Link>
                    ) : (
                      row[column.key]
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
