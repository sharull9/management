"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";

const searchInput = z.string().trim().max(150);
async function pickerContext(
  org: string,
  projectId: string | null,
  purpose: "project" | "stage" | "site" | "team" = "project",
) {
  const ctx = projectId
    ? await requireProjectContext(org, projectId)
    : await requireOrgContext(org);
  assertPermission(
    ctx,
    purpose === "stage"
      ? "stage.manage"
      : purpose === "site" || purpose === "team"
        ? "project.edit"
        : projectId && ctx.permissions.has("project.manage")
          ? "project.manage"
          : projectId
            ? "project.edit"
            : "project.create",
  );
  return ctx;
}
export async function findProjectMembers(
  org: string,
  projectId: string | null,
  purpose: "project" | "stage" | "team",
  query: string,
): Promise<Option[]> {
  const ctx = await pickerContext(org, projectId, purpose);
  const search = searchInput.parse(query);
  const rows = await db.member.findMany({
    where: {
      organizationId: ctx.org.id,
      user: { name: { contains: search, mode: "insensitive" } },
    },
    select: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
    take: 50,
  });
  return rows.map((row) => ({ value: row.user.id, label: row.user.name }));
}
export async function findCustomers(
  org: string,
  projectId: string | null,
  query: string,
): Promise<Option[]> {
  const ctx = await pickerContext(org, projectId);
  const search = searchInput.parse(query);
  const rows = await db.party.findMany({
    where: {
      tenantId: ctx.tenant.id,
      isCustomer: true,
      displayName: { contains: search, mode: "insensitive" },
    },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
    take: 50,
  });
  return rows.map((row) => ({ value: row.id, label: row.displayName }));
}
export async function findCountries(
  org: string,
  projectId: string,
  query: string,
): Promise<Option[]> {
  await pickerContext(org, projectId, "site");
  const search = searchInput.parse(query);
  const rows = await db.country.findMany({
    where: { name: { contains: search, mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return rows.map((row) => ({ value: row.id, label: row.name }));
}
export async function findStates(
  org: string,
  projectId: string,
  countryId: string | null,
  query: string,
): Promise<Option[]> {
  await pickerContext(org, projectId, "site");
  const search = searchInput.parse(query);
  if (!countryId) return [];
  const rows = await db.state.findMany({
    where: { countryId, name: { contains: search, mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return rows.map((row) => ({ value: row.id, label: row.name }));
}
export async function findCities(
  org: string,
  projectId: string,
  stateId: string | null,
  query: string,
): Promise<Option[]> {
  const ctx = await pickerContext(org, projectId, "site");
  const search = searchInput.parse(query);
  if (!stateId) return [];
  const rows = await db.city.findMany({
    where: {
      tenantId: ctx.tenant.id,
      stateId,
      name: { contains: search, mode: "insensitive" },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return rows.map((row) => ({ value: row.id, label: row.name }));
}
