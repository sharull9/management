"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import {
  budgetLineInput,
  budgetLinesInput,
  deleteInput,
  totalBudgetInput,
} from "../schema";
import { budget } from "./budget-service";
export async function budgetLinesAction(
  org: string,
  projectId: string,
  input: z.input<typeof budgetLinesInput>,
) {
  return typedAction(budgetLinesInput, async (parsed) =>
    budget(org, projectId, parsed),
  )(input);
}
export async function budgetAction(
  org: string,
  projectId: string,
  input: z.input<typeof budgetLineInput>,
) {
  return typedAction(budgetLineInput, async (parsed) =>
    budget(org, projectId, parsed),
  )(input);
}
export async function totalBudgetAction(
  org: string,
  projectId: string,
  input: z.input<typeof totalBudgetInput>,
) {
  return typedAction(totalBudgetInput, async (parsed) =>
    budget(org, projectId, parsed),
  )(input);
}
export async function deleteBudgetAction(
  org: string,
  projectId: string,
  input: z.input<typeof deleteInput>,
) {
  return typedAction(deleteInput, async (parsed) =>
    budget(org, projectId, parsed, true),
  )(input);
}
