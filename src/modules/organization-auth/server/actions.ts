"use server";

import { headers } from "next/headers";
import type { z } from "zod";
import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";
import { auth, createAuth } from "@/core/auth/auth";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { typedAction } from "@/core/typed-action";
import { credentials } from "../schema";
export async function setupAction(input: z.input<typeof credentials>) {
  return typedAction(credentials, async (input) => {
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(73194001)::text`;
        if (await tx.user.count())
          throw new UserFacingError("Setup is already complete.");
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
  })(input);
}
export async function signOutAction(_: ActionState, _data: FormData) {
  return runAction(async () => {
    await auth.api.signOut({ headers: await headers() });
    return "/sign-in";
  });
}
