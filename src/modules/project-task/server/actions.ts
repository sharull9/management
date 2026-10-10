"use server";
import type { ActionState } from "@/core/action-result";
import { saveTask } from "./service";
export async function saveTaskAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return saveTask(org, projectId, _, data);
}
