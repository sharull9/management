"use server";

import { type z as Zod, z } from "zod";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { typedAction } from "@/core/typed-action";
import { assetAllocationInput, assetInput } from "../schema";
import {
  deleteAllocation,
  saveAllocation,
  saveAsset,
} from "./registry-service";

const deleteInput = z.object({ id });

export async function saveAssetAction(
  org: string,
  input: Zod.input<typeof assetInput>,
) {
  return typedAction(assetInput, async (data) => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "asset.manage");
    await db.$transaction(async (tx) => {
      await saveAsset(tx, ctx, data);
    });
  })(input);
}

export async function saveAllocationAction(
  org: string,
  input: Zod.input<typeof assetAllocationInput>,
) {
  return typedAction(assetAllocationInput, async (data) => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "asset.manage");
    const projectCtx = await requireProjectContext(org, data.projectId);
    assertPermission(projectCtx, "asset.manage");
    await db.$transaction(async (tx) => {
      await saveAllocation(tx, projectCtx, data);
    });
  })(input);
}

export async function deleteAllocationAction(
  org: string,
  input: { id: string },
) {
  return typedAction(deleteInput, async ({ id: allocationId }) => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "asset.manage");
    const allocation = await db.assetAllocation.findFirstOrThrow({
      where: { id: allocationId, organizationId: ctx.org.id },
      select: { projectId: true },
    });
    const projectCtx = await requireProjectContext(org, allocation.projectId);
    assertPermission(projectCtx, "asset.manage");
    await db.$transaction(async (tx) => {
      await deleteAllocation(tx, projectCtx, allocationId);
    });
  })(input);
}
