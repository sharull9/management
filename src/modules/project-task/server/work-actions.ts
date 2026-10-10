"use server";
import type { ActionState } from "@/core/action-result";
import { taskWork } from "./work-service";
export async function taskWorkAction(
  org: string,
  projectId: string,
  taskId: string,
  _: ActionState,
  data: FormData,
) {
  return taskWork(org, projectId, taskId, _, data);
}
