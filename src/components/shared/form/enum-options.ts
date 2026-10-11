import type { Option } from "@/components/shared/combobox";

export function toOptions(
  rows: readonly { id: string; name: string }[],
): Option[] {
  return rows.map(({ id, name }) => ({ value: id, label: name }));
}

export function enumOptions(values: Record<string, string>): Option[] {
  return Object.values(values).map((value) => ({
    value,
    label: value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  }));
}
