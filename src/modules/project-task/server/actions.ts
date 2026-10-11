"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { saveTaskInput } from "../schema";
import { saveTask } from "./service";
export async function saveTaskAction(
  org: string,
  projectId: string,
  input: z.input<typeof saveTaskInput>,
) {
  return typedAction(saveTaskInput, (parsed) =>
    saveTask(org, projectId, parsed),
  )(input);
}
