export const money = (v: { toFixed: (places: number) => string }) =>
  v.toFixed(2);
export const date = (d: Date) => d.toISOString().slice(0, 10);
export const linkClass = "text-sm font-medium underline underline-offset-4";
