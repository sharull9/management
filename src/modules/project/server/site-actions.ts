"use server";
import type { ActionState } from "@/core/action-result";
import { site } from "./site-service";
export async function siteAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return site(org, projectId, _, data);
}
