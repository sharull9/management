import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import type { OrgContext } from "@/core/context";

type Resolve = (specifier: string, context: object) => { url: string };
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve: (
      specifier: string,
      context: object,
      next: Resolve,
    ) => { url: string };
  }) => { deregister: () => void };
};

type TestContexts = {
  org: OrgContext;
  project: Awaited<
    ReturnType<typeof import("@/core/context").requireProjectContext>
  >;
};
const contextState = globalThis as typeof globalThis & {
  __authorizationTestContexts?: TestContexts;
};

function findProp(node: unknown, key: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  const props = "props" in node ? node.props : undefined;
  if (props && typeof props === "object") {
    if (key in props) return (props as Record<string, unknown>)[key];
    for (const child of Object.values(props)) {
      const result = findProp(child, key);
      if (result !== undefined) return result;
    }
  }
  if (Array.isArray(node))
    for (const child of node) {
      const result = findProp(child, key);
      if (result !== undefined) return result;
    }
  return undefined;
}

function findProps(
  node: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!node || typeof node !== "object") return undefined;
  const props = "props" in node ? node.props : undefined;
  if (props && typeof props === "object") {
    if (key in props) return props as Record<string, unknown>;
    for (const child of Object.values(props)) {
      const result = findProps(child, key);
      if (result) return result;
    }
  }
  if (Array.isArray(node))
    for (const child of node) {
      const result = findProps(child, key);
      if (result) return result;
    }
  return undefined;
}

test(
  "project and member authorization actions protect manager access, pay data, and named approvers",
  {
    skip:
      process.env.AUTHORIZATION_DB_TEST !== "local-only" ||
      process.env.DATABASE_URL === undefined,
  },
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "AUTHORIZATION_DB_TEST requires a loopback DATABASE_URL",
    );
    assert.match(
      url.pathname,
      /_test$/,
      "Use a disposable database whose name ends in _test.",
    );
    const contextUrl = new URL(
      "./authorization.test-context.ts",
      import.meta.url,
    ).href;
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context);
        if (specifier === "server-only")
          return {
            ...resolved,
            url: resolved.url.replace("index.js", "empty.js"),
          };
        if (specifier === "@/core/context")
          return { ...resolved, url: contextUrl };
        return resolved;
      },
    });

    try {
      const { db } = await import("@/core/db");
      const token = `authz-${crypto.randomUUID()}`;
      const tenant = await db.tenant.create({
        data: { name: token, slug: token },
      });
      const org = await db.organization.create({
        data: { name: token, slug: token, tenantId: tenant.id },
      });
      const [actor, projectManager, target, namedApprover] = await Promise.all(
        ["actor", "manager", "target", "approver"].map((name) =>
          db.user.create({
            data: {
              name: `${token}-${name}`,
              email: `${token}-${name}@example.test`,
            },
          }),
        ),
      );
      const users = [actor, projectManager, target, namedApprover];
      await db.tenantMember.createMany({
        data: users.map((user) => ({ tenantId: tenant.id, userId: user.id })),
      });
      await db.member.createMany({
        data: users.map((user) => ({
          organizationId: org.id,
          userId: user.id,
        })),
      });
      const projectRole = await db.role.create({
        data: {
          tenantId: tenant.id,
          name: `${token}-elevated`,
          permissions: ["project.manage"],
        },
      });
      await db.member.update({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: target.id,
          },
        },
        data: { roleId: projectRole.id },
      });
      const project = await db.project.create({
        data: {
          organizationId: org.id,
          code: token,
          name: token,
          currency: "INR",
          managerUserId: projectManager.id,
        },
      });
      await db.projectMember.create({
        data: {
          projectId: project.id,
          userId: projectManager.id,
          isManager: true,
        },
      });
      const worker = await db.worker.create({
        data: {
          organizationId: org.id,
          code: token,
          name: `${token}-worker`,
          payType: "DAILY",
          salaryAmount: 9000,
        },
      });
      await db.projectWorker.create({
        data: {
          projectId: project.id,
          workerId: worker.id,
          startDate: new Date("2026-01-01T00:00:00Z"),
          dayRateOverride: 1234.5,
          otHourlyRateOverride: 111.25,
        },
      });
      const orgContext = {
        org,
        tenant,
        user: actor,
        member: { roleId: null },
        tenantRole: "MEMBER",
        isAdmin: false,
        permissions: new Set(["members.manage"]),
      } as unknown as OrgContext;
      contextState.__authorizationTestContexts = {
        org: orgContext,
        project: {
          ...orgContext,
          project,
          projectMember: null,
          isProjectManager: false,
          permissions: new Set(["project.edit"]),
        } as unknown as TestContexts["project"],
      };

      try {
        const { saveProjectAction } = await import(
          "@/modules/project/server/actions"
        );
        for (const attemptedManagerId of [actor.id, target.id]) {
          const saveResult = await saveProjectAction(org.slug, {
            id: project.id,
            name: project.name,
            description: "",
            status: project.status,
            budgetAmount: "0",
            currency: project.currency,
            clientPartyId: null,
            managerUserId: attemptedManagerId,
            startDate: "",
            endDate: "",
            customerName: "",
            customerLegalName: "",
            confirmCostRecognitionChange: false,
          });
          assert.match(saveResult.error ?? "", /project settings management/i);
        }
        assert.equal(
          (await db.project.findUniqueOrThrow({ where: { id: project.id } }))
            .managerUserId,
          projectManager.id,
          "failed manager reassignment must leave the project unchanged",
        );

        const { teamAction, removeMemberAction } = await import(
          "@/modules/project-team/server/actions"
        );
        const { saveMemberAction } = await import(
          "@/modules/organization/server/member-actions"
        );
        const clearCustomRole = await saveMemberAction(org.slug, {
          existingEmail: target.email,
          email: target.email,
          name: target.name,
          password: "",
          role: "member",
          roleId: null,
        });
        assert.match(clearCustomRole.error ?? "", /only administrators/i);
        assert.equal(
          (
            await db.member.findUniqueOrThrow({
              where: {
                organizationId_userId: {
                  organizationId: org.id,
                  userId: target.id,
                },
              },
            })
          ).roleId,
          projectRole.id,
          "failed role clearing must preserve the custom role",
        );
        const promotion = await teamAction(org.slug, project.id, {
          userId: target.id,
          roleId: null,
          isManager: true,
        });
        assert.match(promotion.error ?? "", /project settings management/i);
        assert.equal(
          await db.projectMember.count({
            where: { projectId: project.id, userId: target.id },
          }),
          0,
        );
        const roleEscalation = await teamAction(org.slug, project.id, {
          userId: target.id,
          roleId: projectRole.id,
          isManager: false,
        });
        assert.match(roleEscalation.error ?? "", /grant permissions you hold/i);
        const managerRemoval = await removeMemberAction(org.slug, project.id, {
          userId: projectManager.id,
        });
        assert.match(
          managerRemoval.error ?? "",
          /project settings management/i,
        );
        assert.equal(
          await db.projectMember.count({
            where: { projectId: project.id, userId: projectManager.id },
          }),
          1,
        );

        const { TeamView } = await import(
          "@/modules/project-team/ui/views/team-view"
        );
        const tree = (await TeamView({
          org: org.slug,
          projectId: project.id,
        })) as {
          props: { children: unknown[] };
        };
        const tabs = tree.props.children[1] as {
          props: { tabs: { content: { props: { children: unknown[] } } }[] };
        };
        assert.equal(
          findProp(tabs.props.tabs[0].content, "canManageApprovers"),
          false,
        );
        const workersTable = findProps(tabs.props.tabs[1].content, "data");
        assert.ok(workersTable);
        assert.equal(workersTable.canViewRates, false);
        const workerRows = workersTable.data as Record<string, unknown>[];
        assert.equal(workerRows.length, 1);
        assert.equal("dayRateOverride" in workerRows[0], false);
        assert.equal("otHourlyRateOverride" in workerRows[0], false);

        const policy = await db.approvalPolicy.create({
          data: {
            organizationId: org.id,
            documentType: "PURCHASE_ORDER",
            scopeKey: "org",
            name: token,
            active: true,
            steps: {
              create: {
                sequence: 1,
                name: "Named approver",
                approverType: "USER",
                userId: namedApprover.id,
              },
            },
          },
        });
        const { removeMemberAction: removeOrganizationMember } = await import(
          "@/modules/organization/server/member-actions"
        );
        const activePolicyBlock = await removeOrganizationMember(org.slug, {
          id: (
            await db.member.findUniqueOrThrow({
              where: {
                organizationId_userId: {
                  organizationId: org.id,
                  userId: namedApprover.id,
                },
              },
            })
          ).id,
        });
        assert.match(
          activePolicyBlock.error ?? "",
          /active approval policies/i,
        );
        await db.approvalPolicy.update({
          where: { id: policy.id },
          data: { active: false },
        });
        const request = await db.approvalRequest.create({
          data: {
            organizationId: org.id,
            documentType: "PURCHASE_ORDER",
            documentId: `${token}-document`,
            title: token,
            requestedById: actor.id,
            status: "PENDING",
          },
        });
        const step = await db.approvalRequestStep.create({
          data: {
            requestId: request.id,
            sequence: 1,
            name: "Named approver",
            approverType: "USER",
            userId: namedApprover.id,
            status: "PENDING",
          },
        });
        const approverMember = await db.member.findUniqueOrThrow({
          where: {
            organizationId_userId: {
              organizationId: org.id,
              userId: namedApprover.id,
            },
          },
        });
        const pendingBlock = await removeOrganizationMember(org.slug, {
          id: approverMember.id,
        });
        assert.match(pendingBlock.error ?? "", /pending approval requests/i);
        await db.approvalRequestStep.update({
          where: { id: step.id },
          data: { status: "WAITING" },
        });
        const waitingBlock = await removeOrganizationMember(org.slug, {
          id: approverMember.id,
        });
        assert.match(waitingBlock.error ?? "", /pending approval requests/i);
        assert.ok(
          await db.member.findUnique({ where: { id: approverMember.id } }),
          "blocked offboarding must preserve the named approver's organization access",
        );
      } finally {
        await db.auditLog.deleteMany({ where: { organizationId: org.id } });
        await db.approvalRequestStep.deleteMany({
          where: { request: { organizationId: org.id } },
        });
        await db.approvalRequest.deleteMany({
          where: { organizationId: org.id },
        });
        await db.approvalPolicyStep.deleteMany({
          where: { policy: { organizationId: org.id } },
        });
        await db.approvalPolicy.deleteMany({
          where: { organizationId: org.id },
        });
        await db.projectWorker.deleteMany({ where: { projectId: project.id } });
        await db.projectMember.deleteMany({ where: { projectId: project.id } });
        await db.project.delete({ where: { id: project.id } });
        await db.worker.delete({ where: { id: worker.id } });
        await db.role.delete({ where: { id: projectRole.id } });
        await db.member.deleteMany({ where: { organizationId: org.id } });
        await db.tenantMember.deleteMany({ where: { tenantId: tenant.id } });
        await db.organization.delete({ where: { id: org.id } });
        await db.tenant.delete({ where: { id: tenant.id } });
        await db.user.deleteMany({
          where: { id: { in: users.map(({ id }) => id) } },
        });
      }
      await db.$disconnect();
    } finally {
      delete contextState.__authorizationTestContexts;
      hooks.deregister();
    }
  },
);
