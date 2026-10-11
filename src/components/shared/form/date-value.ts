export const dateValue = (date?: Date | null) =>
  date?.toISOString().slice(0, 10) ?? "";
