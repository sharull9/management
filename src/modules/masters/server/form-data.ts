export const val = (data: FormData, key: string) => String(data.get(key) ?? "");
export const opt = (data: FormData, key: string) =>
  val(data, key).trim() || null;
export const flag = (data: FormData, key: string) => data.get(key) === "on";
