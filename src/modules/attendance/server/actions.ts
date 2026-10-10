"use server";
import type { ActionState } from "@/core/action-result";
import { attendance } from "./service";
export async function attendanceAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return attendance(org, projectId, _, data);
}
