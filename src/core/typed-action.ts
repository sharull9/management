import "server-only";
import type { z } from "zod";
import { type ActionState, runAction } from "./action-result";

export function typedAction<TInput, TOutput>(
  schema: z.ZodType<TOutput, TInput>,
  handler: (input: TOutput) => Promise<string | undefined>,
): (input: TInput) => Promise<ActionState> {
  return (input) => runAction(() => handler(schema.parse(input)));
}
