"use client";
import {
  adminClient,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";
export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    organizationClient({ schema: inferOrgAdditionalFields<typeof auth>() }),
  ],
});
