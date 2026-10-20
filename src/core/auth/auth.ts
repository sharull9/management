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
    // All organization HTTP endpoints are unused. They bypass the tenant-aware
    // DAL and expose member metadata without rechecking tenant membership.
    disabledPaths: [
      "/organization/has-permission",
      "/organization/create",
      "/organization/update",
      "/organization/delete",
      "/organization/set-active",
      "/organization/get-organization",
      "/organization/get-full-organization",
      "/organization/list",
      "/organization/check-slug",
      "/organization/add-member",
      "/organization/update-member-role",
      "/organization/remove-member",
      "/organization/get-active-member",
      "/organization/get-active-member-role",
      "/organization/list-members",
      "/organization/leave",
      "/organization/invite-member",
      "/organization/cancel-invitation",
      "/organization/get-invitation",
      "/organization/list-invitations",
      "/organization/list-user-invitations",
      "/organization/accept-invitation",
      "/organization/reject-invitation",
      "/organization/create-role",
      "/organization/delete-role",
      "/organization/list-roles",
      "/organization/get-role",
      "/organization/update-role",
      "/organization/create-team",
      "/organization/remove-team",
      "/organization/update-team",
      "/organization/list-teams",
      "/organization/set-active-team",
      "/organization/list-user-teams",
      "/organization/list-team-members",
      "/organization/add-team-member",
      "/organization/remove-team-member",
    ],
  });
}
export const auth = createAuth();
