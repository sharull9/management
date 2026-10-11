"use server";

import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { id } from "../schema";

async function pickerContext(org: string, query: string) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "approval.policy.manage");
  return { ctx, search: z.string().max(150).parse(query).trim() };
}

export async function findApprovalRoles(
  org: string,
  query: string,
): Promise<Option[]> {
  const { ctx, search } = await pickerContext(org, query);
  const roles = await db.role.findMany({
    where: {
      tenantId: ctx.tenant.id,
      name: { contains: search, mode: "insensitive" },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 30,
  });
  return roles.map((role) => ({ value: role.id, label: role.name }));
}

export async function findApprovalUsers(
  org: string,
  query: string,
): Promise<Option[]> {
  const { ctx, search } = await pickerContext(org, query);
  const members = await db.member.findMany({
    where: {
      organizationId: ctx.org.id,
      user: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      },
    },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
    take: 30,
  });
  return members.map(({ user }) => ({
    value: user.id,
    label: user.name,
    description: user.email,
  }));
}

export async function findApprovalProjects(
  org: string,
  query: string,
): Promise<Option[]> {
  const { ctx, search } = await pickerContext(org, query);
  const projects = await db.project.findMany({
    where: {
      organizationId: ctx.org.id,
      name: { contains: search, mode: "insensitive" },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 30,
  });
  return projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));
}

export async function findApprovalStages(
  org: string,
  projectId: string | null,
  query: string,
): Promise<Option[]> {
  const { ctx, search } = await pickerContext(org, query);
  if (!projectId) return [];
  const stages = await db.stage.findMany({
    where: {
      projectId: id.parse(projectId),
      project: { organizationId: ctx.org.id },
      name: { contains: search, mode: "insensitive" },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 30,
  });
  return stages.map((stage) => ({ value: stage.id, label: stage.name }));
}
