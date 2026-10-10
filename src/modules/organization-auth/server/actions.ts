"use server";
import { headers } from "next/headers";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";
import { auth, createAuth } from "@/core/auth/auth";

import { db } from "@/core/db";
import { credentials, signInInput } from "../schema";
export async function setupAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const input = credentials.parse(Object.fromEntries(data));
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(73194001)::text`;
        if (await tx.user.count())
          throw new Error("Setup is already complete.");
        const { user } = await createAuth(tx).api.createUser({
          body: { ...input, role: "admin" },
        });
        await writeAudit(
          {
            userId: user.id,
            action: "SETUP",
            entityType: "User",
            entityId: user.id,
          },
          tx,
        );
      },
      { timeout: 30000 },
    );
    return "/sign-in";
  });
}
export async function signInAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const input = signInInput.parse(Object.fromEntries(data));
    await auth.api.signInEmail({ body: input, headers: await headers() });
    return "/";
  });
}
export async function signOutAction(_: ActionState, _data: FormData) {
  return runAction(async () => {
    await auth.api.signOut({ headers: await headers() });
    return "/sign-in";
  });
}
