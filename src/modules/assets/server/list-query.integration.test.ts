import assert from "node:assert/strict";
import test from "node:test";
import { listParams, pageInfo } from "@/core/pagination";
import { assetListWhere } from "./list-query-helpers";
import { withAssetTestDatabase } from "./test-database";

test(
  "asset query predicates enforce organization/project filters and bounded pages",
  { skip: process.env.ASSETS_DB_TEST !== "local-only" },
  async () => {
    await withAssetTestDatabase(async (tx) => {
      const token = `asset-query-${crypto.randomUUID()}`;
      const tenant = await tx.tenant.create({
        data: { name: token, slug: token },
      });
      const org = await tx.organization.create({
        data: { name: token, slug: token, tenantId: tenant.id },
      });
      const project = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "Q1",
          name: "Visible",
          currency: "INR",
        },
      });
      const otherProject = await tx.project.create({
        data: {
          organizationId: org.id,
          code: "Q2",
          name: "Other",
          currency: "INR",
        },
      });
      const assets = await Promise.all(
        ["Fleet One", "Fleet Two", "Fleet Three", "Other Fleet"].map(
          (name, index) =>
            tx.asset.create({
              data: {
                organizationId: org.id,
                code: `${token}-${index}`,
                name,
                type: "VEHICLE",
                meterType: "KM",
                powerType: "DIESEL",
              },
            }),
        ),
      );
      await Promise.all(
        assets.map((asset, index) =>
          tx.assetAllocation.create({
            data: {
              organizationId: org.id,
              assetId: asset.id,
              projectId:
                index === assets.length - 1 ? otherProject.id : project.id,
              startDate: new Date("2026-01-01T00:00:00Z"),
            },
          }),
        ),
      );
      const where = assetListWhere(
        org.id,
        project.id,
        "VEHICLE",
        true,
        "fleet",
      );
      const total = await tx.asset.count({ where });
      const window = listParams({ page: "99" }, 2);
      const page = pageInfo(total, window);
      const rows = await tx.asset.findMany({
        where,
        orderBy: { code: "asc" },
        skip: (page.page - 1) * window.pageSize,
        take: window.take,
      });
      assert.equal(total, 3);
      assert.equal(page.page, 2);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, assets[2].id);
    });
  },
);
