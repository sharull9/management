import assert from "node:assert/strict";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export async function createFixture(
  db: PrismaClient,
  origin: string,
  password: string,
) {
  const { requireOrgContext } = await import("@/core/context");
  const token = `phase3b-${Date.now()}`;
  const user = await db.user.upsert({
    where: { email: "phase3b@example.test" },
    create: {
      email: "phase3b@example.test",
      name: "Phase 3b owner",
      emailVerified: true,
    },
    update: {},
  });
  await db.account.upsert({
    where: { id: "phase3b-password" },
    create: {
      id: "phase3b-password",
      accountId: user.id,
      userId: user.id,
      providerId: "credential",
      password: await hashPassword(password as string),
    },
    update: { password: await hashPassword(password as string) },
  });
  const tenant = await db.tenant.create({
    data: { slug: token, name: token },
  });
  await db.tenantMember.create({
    data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
  });
  const country = await db.country.findUniqueOrThrow({
    where: { code: "IN" },
  });
  const state = await db.state.findUniqueOrThrow({
    where: { countryId_code: { countryId: country.id, code: "TN" } },
  });
  const org = await db.organization.create({
    data: {
      slug: token,
      name: "Phase 3b integration",
      tenantId: tenant.id,
      countryId: country.id,
      stateId: state.id,
      baseCurrency: "INR",
    },
  });
  await db.member.create({
    data: { organizationId: org.id, userId: user.id, role: "owner" },
  });
  const response = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email: user.email, password }),
  });
  assert.equal(response.status, 200, await response.text());
  process.env.PHASE3B_SMOKE_COOKIE = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const ctx = await requireOrgContext(org.slug);
  assert.equal(ctx.user.id, user.id);
  const vendor = await db.party.create({
    data: {
      tenantId: tenant.id,
      code: "VENDOR",
      legalName: "Smoke vendor",
      displayName: "Smoke vendor",
      isVendor: true,
      addresses: {
        create: {
          countryId: country.id,
          stateId: state.id,
          isDefault: true,
          label: "Default",
          addressLine1: "Local vendor",
        },
      },
    },
  });
  const customer = await db.party.create({
    data: {
      tenantId: tenant.id,
      code: "CUSTOMER",
      legalName: "Smoke customer",
      displayName: "Smoke customer",
      isCustomer: true,
      addresses: {
        create: {
          countryId: country.id,
          stateId: state.id,
          isDefault: true,
          label: "Default",
          addressLine1: "Local customer",
        },
      },
    },
  });
  const projects = await Promise.all(
    ["ON_RECEIPT", "ON_CONSUMPTION"].map((mode, index) =>
      db.project.create({
        data: {
          organizationId: org.id,
          code: `P${index + 1}`,
          name: `P${index + 1} ${mode}`,
          currency: "INR",
          materialCostRecognition: mode as "ON_RECEIPT" | "ON_CONSUMPTION",
          managerUserId: user.id,
          clientPartyId: customer.id,
        },
      }),
    ),
  );
  const [p1, p2] = projects;
  const uom = await db.uom.findFirstOrThrow({
    where: { tenantId: null, code: "kg" },
  });
  const components = await Promise.all(
    [
      ["CGST", "9", false],
      ["SGST", "9", false],
      ["TDS", "1", true],
    ].map(([name, rate, withholding]) =>
      db.taxComponent.create({
        data: {
          tenantId: tenant.id,
          name: String(name),
          code: String(name),
          rate: String(rate),
          isWithholding: Boolean(withholding),
        },
      }),
    ),
  );
  const tax = await db.taxGroup.create({
    data: {
      tenantId: tenant.id,
      name: "GST 18% + TDS 1%",
      countryId: country.id,
      scope: "INTRA",
      components: {
        create: components.map((c, sequence) => ({
          componentId: c.id,
          sequence,
        })),
      },
    },
  });
  const item = await db.item.create({
    data: {
      tenantId: tenant.id,
      code: "MATERIAL",
      name: "Smoke material",
      type: "RAW_MATERIAL",
      stockTracked: true,
      stockUomId: uom.id,
      defaultTaxGroupId: tax.id,
    },
  });
  const selection = { itemId: item.id, levels: [], uomId: uom.id };

  return {
    token,
    user,
    tenant,
    org,
    ctx,
    vendor,
    customer,
    projects,
    p1,
    p2,
    uom,
    state,
    components,
    tax,
    item,
    selection,
  };
}
