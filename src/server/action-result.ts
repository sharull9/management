import "server-only";
import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
export type ActionState = {
  error?: string;
  message?: string;
  redirectTo?: string;
  version?: number;
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
    unstable_rethrow(error);
    if (error instanceof z.ZodError)
      return {
        error: error.issues.map((issue) => issue.message).join(" "),
        version: Date.now(),
      };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Database mutation failed:", error.code);
      return {
        error:
          error.code === "P2002"
            ? "This record already exists."
            : error.code === "P2003"
              ? "This record is still referenced or its location is invalid."
              : "Unable to save this record. Please try again.",
        version: Date.now(),
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to save. Please try again.",
      version: Date.now(),
    };
  }
}
