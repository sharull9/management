"use server";
import { type z as Zod, z } from "zod";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { typedAction } from "@/core/typed-action";
import type { Prisma } from "@/generated/prisma/client";
import { assetFuelLogInput, assetTripInput, assetUsageInput } from "../schema";
import { deleteLog, saveFuelLog, saveTrip, saveUsage } from "./log-service";

type ProjectInput = { projectId: string };

async function runProjectAction(
  org: string,
  input: ProjectInput,
  operation: (
    tx: Prisma.TransactionClient,
    ctx: Awaited<ReturnType<typeof requireProjectContext>>,
  ) => Promise<unknown>,
) {
  const ctx = await requireProjectContext(org, input.projectId);
  if (!ctx.isAdmin && !ctx.permissions.has("asset.log"))
    throw new UserFacingError(
      "You do not have permission to perform this action.",
    );
  await db.$transaction((tx) => operation(tx, ctx));
  return undefined;
}

export async function saveTripAction(
  org: string,
  input: z.input<typeof assetTripInput>,
) {
  return typedAction(
    assetTripInput,
    (parsed: Zod.output<typeof assetTripInput>) =>
      runProjectAction(org, parsed, (tx, ctx) => saveTrip(tx, ctx, parsed)),
  )(input);
}

export async function saveUsageAction(
  org: string,
  input: z.input<typeof assetUsageInput>,
) {
  return typedAction(
    assetUsageInput,
    (parsed: Zod.output<typeof assetUsageInput>) =>
      runProjectAction(org, parsed, (tx, ctx) => saveUsage(tx, ctx, parsed)),
  )(input);
}

export async function saveFuelLogAction(
  org: string,
  input: z.input<typeof assetFuelLogInput>,
) {
  return typedAction(
    assetFuelLogInput,
    (parsed: Zod.output<typeof assetFuelLogInput>) =>
      runProjectAction(org, parsed, (tx, ctx) => saveFuelLog(tx, ctx, parsed)),
  )(input);
}

export async function deleteLogAction(
  org: string,
  input: { kind: "TRIP" | "USAGE" | "FUEL"; id: string },
) {
  return typedAction(
    z.object({
      kind: z.enum(["TRIP", "USAGE", "FUEL"]),
      id: z.string().min(1),
    }),
    async (parsed) => {
      const lookup =
        parsed.kind === "TRIP"
          ? await db.assetTrip.findFirst({
              where: { id: parsed.id, organization: { slug: org } },
              select: { projectId: true },
            })
          : parsed.kind === "USAGE"
            ? await db.assetUsage.findFirst({
                where: { id: parsed.id, organization: { slug: org } },
                select: { projectId: true },
              })
            : await db.assetFuelLog.findFirst({
                where: { id: parsed.id, organization: { slug: org } },
                select: { projectId: true },
              });
      if (!lookup)
        throw new UserFacingError("Log was not found in this organization.");
      return runProjectAction(org, lookup, (tx, ctx) =>
        deleteLog(tx, ctx, parsed),
      );
    },
  )(input);
}
