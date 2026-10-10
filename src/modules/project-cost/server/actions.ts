"use server";
import type { ActionState } from "@/core/action-result";
import { expense, saveProjectCostRecognition } from "./service";
export async function saveProjectCostRecognitionAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return saveProjectCostRecognition(org, projectId, _, data);
}
export async function expenseAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return expense(org, projectId, _, data);
}
