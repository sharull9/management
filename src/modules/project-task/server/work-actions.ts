"use server";
import type { z } from "zod";
import type { ActionState } from "@/core/action-result";
import { typedAction } from "@/core/typed-action";
import { taskOperationInput } from "../schema";
import { performTaskWork, taskWork } from "./work-service";
export async function taskWorkAction(
  org: string,
  projectId: string,
  taskId: string,
  _: ActionState,
  data: FormData,
) {
  return taskWork(org, projectId, taskId, _, data);
}

export async function taskOperationAction(
  org: string,
  projectId: string,
  taskId: string,
  input: z.input<typeof taskOperationInput>,
) {
  return typedAction(taskOperationInput, (parsed) =>
    performTaskWork(org, projectId, taskId, parsed),
  )(input);
}
