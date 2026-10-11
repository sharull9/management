import assert from "node:assert/strict";
import type { PrismaClient } from "@/generated/prisma/client";
import type { createFixture } from "./phase3b-smoke-fixture";
import { pendingSmoke } from "./phase3b-smoke-pending";

export async function linksSmoke(
  db: PrismaClient,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  origin: string,
) {
  const { org } = fixture;
  const { approvalDocumentLinks } = await import(
    "@/modules/approvals/server/document-link"
  );
  await pendingSmoke(db, fixture);
  const requests = await db.approvalRequest.findMany({
    where: { organizationId: org.id },
  });
  assert.deepEqual(
    [...new Set(requests.map((r) => r.documentType))].sort(),
    [
      "PURCHASE_REQUEST",
      "PURCHASE_ORDER",
      "GRN",
      "STOCK_TRANSFER",
      "VENDOR_BILL",
      "PAYMENT_REQUEST",
      "SALES_INVOICE",
      "TASK_SUBMISSION",
      "TASK_DELAY",
      "EXPENSE",
    ].sort(),
  );
  const links = await approvalDocumentLinks(org.slug, requests);
  // Release the standalone service pool before the local app's HTTP checks.
  await db.$disconnect();
  async function render(path: string, expected: string) {
    const page = await fetch(`${origin}${path}`, {
      headers: { Cookie: process.env.PHASE3B_SMOKE_COOKIE as string },
    });
    assert.equal(page.status, 200, `${path} status`);
    assert.equal(new URL(page.url).pathname, path, `${path} redirect`);
    const html = await page.text();
    assert.ok(
      !/This workspace is unavailable|Something went wrong|NEXT_HTTP_ERROR_FALLBACK|:E\{"digest"|Switched to client rendering because the server rendering errored/.test(
        html,
      ),
      `${path} rendering`,
    );
    // Check server-rendered markup, excluding serialized component payloads.
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
    assert.ok(markup.includes(expected), `${path} content: ${expected}`);
    return markup;
  }
  const inbox = await render(`/${org.slug}/approvals`, "Your pending steps");
  for (const r of requests) {
    const link = links.get(r.id);
    assert.ok(link, `${r.documentType} destination`);
    assert.ok(inbox.includes(`href="${link}"`), `${r.documentType} inbox link`);
    const expected = r.documentType.startsWith("TASK_")
      ? "Smoke task"
      : r.documentType === "EXPENSE"
        ? "Pending smoke expense"
        : r.title.split(" ")[0];
    await render(link, expected);
    console.log(`Approval link ${r.documentType}: 200, document rendered.`);
  }
  console.log(
    "All 10 approval document types: inbox links return 200 and render. Negative cost CHECK rejects unrelated negatives.",
  );
}
