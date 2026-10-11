"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { costRecognitionInput, createExpenseInput } from "../schema";
import { expense, saveProjectCostRecognition } from "./service";
export async function expenseAction(
  org: string,
  projectId: string,
  input: z.input<typeof createExpenseInput>,
) {
  return typedAction(createExpenseInput, (parsed) =>
    expense(org, projectId, parsed),
  )(input);
}
export async function saveProjectCostRecognitionAction(
  org: string,
  projectId: string,
  input: z.input<typeof costRecognitionInput>,
) {
  return typedAction(costRecognitionInput, (parsed) =>
    saveProjectCostRecognition(org, projectId, parsed),
  )(input);
}
