import type { z } from "zod";
import type { saveMasterInput } from "../schema";
export type MasterInput = z.output<typeof saveMasterInput>;
export const val = (data: MasterInput, key: keyof MasterInput) =>
  String(data[key] ?? "");
export const opt = (data: MasterInput, key: keyof MasterInput) =>
  val(data, key).trim() || null;
export const flag = (data: MasterInput, key: keyof MasterInput) =>
  data[key] === true;
