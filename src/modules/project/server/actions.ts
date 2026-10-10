"use server";
import type { ActionState } from "@/core/action-result";
import { saveProject } from "./service";
export async function saveProjectAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return saveProject(org, _, data);
}
