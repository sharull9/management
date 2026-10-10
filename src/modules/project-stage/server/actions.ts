"use server";
import type { ActionState } from "@/core/action-result";
import { deleteStage, saveStage } from "./service";
export async function saveStageAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return saveStage(org, projectId, _, data);
}
export async function deleteStageAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return deleteStage(org, projectId, _, data);
}
