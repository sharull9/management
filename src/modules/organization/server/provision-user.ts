import "server-only";

import { writeAudit } from "@/core/audit";
import { createAuth } from "@/core/auth/auth";

import type { Prisma } from "@/generated/prisma/client";

export async function provisionUser(
  data: { name: string; email: string; password: string },
  tx: Prisma.TransactionClient,
  actorId: string,
) {
  // No headers permits trusted server-side provisioning in Better Auth 1.7.7.
  // Every caller below checks platform/tenant authorization before reaching here.
  const { user } = await createAuth(tx).api.createUser({
    body: { ...data, role: "user" },
  });
  await writeAudit(
    {
      userId: actorId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
    },
    tx,
  );
  return user;
}
