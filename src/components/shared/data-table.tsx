import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export function DataTable({
  headings,
  rows,
}: {
  headings: string[];
  rows: { id: string; cells: ReactNode[] }[];
}) {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {headings.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {r.cells.map((c, i) => (
                <TableCell key={headings[i]}>{c}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && (
        <p className="py-4 text-sm text-muted-foreground">No records found.</p>
      )}
    </>
  );
}
