"use server";
import type { ActionState } from "@/core/action-result";
import { team } from "./service";
export async function teamAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return team(org, projectId, _, data);
}
