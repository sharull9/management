"use server";
import type { ActionState } from "@/core/action-result";
import { designation, saveWorker } from "./service";
export async function saveWorkerAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return saveWorker(org, _, data);
}
export async function designationAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return designation(org, _, data);
}
