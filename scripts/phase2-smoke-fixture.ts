import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  if (
    process.env.PHASE2_SMOKE_CONFIRM !== "local-only" ||
    !process.env.PHASE2_SMOKE_PASSWORD
  )
    throw new Error(
      "Set PHASE2_SMOKE_CONFIRM=local-only and PHASE2_SMOKE_PASSWORD for an isolated local DB.",
    );
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Smoke fixtures require a local database.");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.toString() }),
  });
  try {
    const password = await hashPassword(process.env.PHASE2_SMOKE_PASSWORD);
    await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.upsert({
        where: { slug: "phase2-smoke" },
        create: { name: "Phase 2 smoke tenant", slug: "phase2-smoke" },
        update: {},
      });
      const org = await tx.organization.upsert({
        where: { slug: "phase2-smoke" },
        create: {
          name: "Phase 2 smoke",
          slug: "phase2-smoke",
          tenantId: tenant.id,
        },
        update: {},
      });
      for (const kind of ["owner", "member"] as const) {
        const user = await tx.user.upsert({
          where: { email: `${kind}@phase2.example.test` },
          create: {
            name: `Smoke ${kind}`,
            email: `${kind}@phase2.example.test`,
            emailVerified: true,
          },
          update: {},
        });
        const account = await tx.account.findFirst({
          where: { userId: user.id, providerId: "credential" },
        });
        if (account)
          await tx.account.update({
            where: { id: account.id },
            data: { password },
          });
        else
          await tx.account.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              accountId: user.id,
              providerId: "credential",
              password,
            },
          });
        await tx.tenantMember.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
          create: {
            tenantId: tenant.id,
            userId: user.id,
            role: kind === "owner" ? "OWNER" : "MEMBER",
          },
          update: {},
        });
        await tx.member.upsert({
          where: {
            organizationId_userId: { organizationId: org.id, userId: user.id },
          },
          create: { organizationId: org.id, userId: user.id, role: kind },
          update: {},
        });
      }
    });
    console.log(
      "Local smoke fixture ready: /phase2-smoke; owner and restricted member.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
