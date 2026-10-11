"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { deleteStageInput, stageFormInput } from "../schema";
import { deleteStage, saveStage } from "./service";
export async function saveStageAction(
  org: string,
  projectId: string,
  input: z.input<typeof stageFormInput>,
) {
  return typedAction(stageFormInput, async (parsed) =>
    saveStage(org, projectId, parsed),
  )(input);
}
export async function deleteStageAction(
  org: string,
  projectId: string,
  input: z.input<typeof deleteStageInput>,
) {
  return typedAction(deleteStageInput, async (parsed) =>
    deleteStage(org, projectId, parsed),
  )(input);
}
