"use server";
import type { ActionState } from "@/core/action-result";
import { budget } from "./budget-service";
export async function budgetAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return budget(org, projectId, _, data);
}
