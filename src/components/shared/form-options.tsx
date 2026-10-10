export const dateValue = (date?: Date | null) =>
  date?.toISOString().slice(0, 10) ?? "";
export function Options({
  rows,
  empty = "None",
  blank = true,
}: {
  rows: { id: string; name: string }[];
  empty?: string;
  blank?: boolean;
}) {
  return (
    <>
      {blank && <option value="">{empty}</option>}
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </>
  );
}
export function EnumOptions({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.values(values).map((v) => (
        <option key={v} value={v}>
          {v.replaceAll("_", " ")}
        </option>
      ))}
    </>
  );
}
