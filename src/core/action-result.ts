import "server-only";
import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { UserFacingError } from "./errors";
export type ActionState = {
  error?: string;
  message?: string;
  redirectTo?: string;
  version?: number;
  fieldErrors?: Record<string, string[]>;
};
export async function runAction(
  work: () => Promise<string | undefined>,
): Promise<ActionState> {
  try {
    const redirectTo = await work();
    if (redirectTo) redirect(redirectTo);
    refresh();
    return { message: "Saved successfully.", redirectTo, version: Date.now() };
  } catch (error) {
    return actionFailure(error);
  }
}

export function actionFailure(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof z.ZodError) {
    const errors = new Map<string, string[]>();
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      const messages = errors.get(path) ?? [];
      messages.push(issue.message);
      errors.set(path, messages);
    }
    return {
      error: error.issues.map((issue) => issue.message).join(" "),
      fieldErrors: Object.fromEntries(errors),
      version: Date.now(),
    };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2003"].includes(error.code)
  ) {
    return {
      error:
        error.code === "P2002"
          ? "This record already exists."
          : "This record is still referenced or its location is invalid.",
      version: Date.now(),
    };
  }
  if (error instanceof UserFacingError)
    return { error: error.message, version: Date.now() };
  const reference = randomUUID();
  console.error("Unexpected action failure", {
    reference,
    name: error instanceof Error ? error.name : typeof error,
    code:
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : undefined,
    frames:
      error instanceof Error
        ? error.stack?.split("\n").filter((line) => /^\s*at /.test(line))
        : undefined,
  });
  return {
    error: `Unable to save. Please try again. Reference: ${reference}`,
    version: Date.now(),
  };
}
