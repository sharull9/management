import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { db } from "@/core/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export function createAuth(
  client: PrismaClient | Prisma.TransactionClient = db,
) {
  return betterAuth({
    appName: "Management",
    database: prismaAdapter(client, { provider: "postgresql" }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [
      admin(),
      organization({
        allowUserToCreateOrganization: false,
        schema: {
          organization: {
            additionalFields: {
              tenantId: { type: "string", required: true, input: false },
            },
          },
          member: {
            additionalFields: {
              roleId: { type: "string", required: false, input: false },
            },
          },
        },
      }),
      nextCookies(),
    ],
    // Organization mutations use our DAL. Plugin endpoints would bypass tenant
    // suspension, tenant membership and the last-owner safeguards.
    disabledPaths: [
      "/organization/create",
      "/organization/update",
      "/organization/delete",
      "/organization/add-member",
      "/organization/update-member-role",
      "/organization/remove-member",
      "/organization/leave",
      "/organization/invite-member",
      "/organization/accept-invitation",
    ],
  });
}
export const auth = createAuth();
