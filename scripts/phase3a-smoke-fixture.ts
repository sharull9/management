import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.PHASE3A_SMOKE_CONFIRM !== "local-only" ||
    !process.env.PHASE3A_SMOKE_PASSWORD ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error(
      "Provide local DATABASE_URL, PHASE3A_SMOKE_CONFIRM=local-only and PHASE3A_SMOKE_PASSWORD.",
    );
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.toString() }),
  });
  try {
    const user = await db.user.upsert({
      where: { email: "phase3a@example.test" },
      create: {
        name: "Phase 3a owner",
        email: "phase3a@example.test",
        emailVerified: true,
      },
      update: {},
    });
    await db.account.upsert({
      where: { id: "phase3a-password" },
      create: {
        id: "phase3a-password",
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword(process.env.PHASE3A_SMOKE_PASSWORD),
      },
      update: {
        password: await hashPassword(process.env.PHASE3A_SMOKE_PASSWORD),
      },
    });
    const tenant = await db.tenant.upsert({
      where: { slug: "phase3a-smoke" },
      create: { slug: "phase3a-smoke", name: "Phase 3a smoke" },
      update: {},
    });
    await db.tenantMember.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
      update: {},
    });
    const country = await db.country.findUniqueOrThrow({
        where: { code: "IN" },
      }),
      state = await db.state.findUniqueOrThrow({
        where: { countryId_code: { countryId: country.id, code: "TN" } },
      });
    const org = await db.organization.upsert({
      where: { slug: "phase3a" },
      create: {
        tenantId: tenant.id,
        slug: "phase3a",
        name: "Phase 3a construction",
        countryId: country.id,
        stateId: state.id,
        baseCurrency: "INR",
      },
      update: {},
    });
    await db.member.upsert({
      where: {
        organizationId_userId: { organizationId: org.id, userId: user.id },
      },
      create: { organizationId: org.id, userId: user.id, role: "owner" },
      update: {},
    });
    const project = await db.project.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: "PRJ-SMOKE-A" },
      },
      create: {
        organizationId: org.id,
        code: "PRJ-SMOKE-A",
        name: "Smoke source",
        currency: "INR",
        budgetAmount: "10000",
        managerUserId: user.id,
      },
      update: {},
    });
    await db.project.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: "PRJ-SMOKE-B" },
      },
      create: {
        organizationId: org.id,
        code: "PRJ-SMOKE-B",
        name: "Smoke destination",
        currency: "INR",
        managerUserId: user.id,
      },
      update: {},
    });
    const stage = await db.stage.upsert({
      where: { id: "phase3a-stage" },
      create: {
        id: "phase3a-stage",
        projectId: project.id,
        name: "Foundation",
        sequence: 1,
        managerUserId: user.id,
      },
      update: {},
    });
    await db.task.upsert({
      where: { id: "phase3a-task" },
      create: {
        id: "phase3a-task",
        projectId: project.id,
        stageId: stage.id,
        code: "TSK-SMOKE",
        title: "Pour concrete",
      },
      update: {},
    });
    await db.projectSite.upsert({
      where: { id: "phase3a-site" },
      create: {
        id: "phase3a-site",
        projectId: project.id,
        name: "Main site",
        countryId: country.id,
        stateId: state.id,
        address: "Smoke address",
      },
      update: {},
    });
    const reader = await db.user.upsert({
      where: { email: "phase3a-reader@example.test" },
      create: {
        name: "Phase 3a reader",
        email: "phase3a-reader@example.test",
        emailVerified: true,
      },
      update: {},
    });
    await db.account.upsert({
      where: { id: "phase3a-reader-password" },
      create: {
        id: "phase3a-reader-password",
        userId: reader.id,
        accountId: reader.id,
        providerId: "credential",
        password: await hashPassword(process.env.PHASE3A_SMOKE_PASSWORD),
      },
      update: {
        password: await hashPassword(process.env.PHASE3A_SMOKE_PASSWORD),
      },
    });
    await db.tenantMember.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: reader.id } },
      create: { tenantId: tenant.id, userId: reader.id, role: "MEMBER" },
      update: {},
    });
    await db.member.upsert({
      where: {
        organizationId_userId: { organizationId: org.id, userId: reader.id },
      },
      create: { organizationId: org.id, userId: reader.id, role: "member" },
      update: {},
    });
    const role = await db.role.upsert({
      where: {
        tenantId_name: { tenantId: tenant.id, name: "Phase 3a project reader" },
      },
      create: {
        tenantId: tenant.id,
        name: "Phase 3a project reader",
        permissions: ["purchase.view", "inventory.view"],
      },
      update: { permissions: ["purchase.view", "inventory.view"] },
    });
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: reader.id } },
      create: { projectId: project.id, userId: reader.id, roleId: role.id },
      update: { roleId: role.id },
    });
    console.log(
      "Local identity, source/destination projects, stage, task and site ready. Login: phase3a@example.test",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
