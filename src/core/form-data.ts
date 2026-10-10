export const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "");
export const optional = (data: FormData, key: string) =>
  value(data, key).trim() || null;
