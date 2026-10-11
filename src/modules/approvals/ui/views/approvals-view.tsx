import { PageHeading } from "@/components/shared/page-heading";
import { UrlTabs } from "@/components/shared/url-tabs";
import { formatMoney } from "@/core/format";
import { approvalInbox } from "../../server/queries";
import {
  ApprovalHistoryTable,
  PendingApprovalsTable,
} from "../components/approvals-tables";

export async function ApprovalsView({ org }: { org: string }) {
  const { ctx, pending, history, links } = await approvalInbox(org);
  return (
    <>
      <PageHeading
        title="Approvals"
        description="Review project work, expenses, procurement and stock transfers. Rejections require a comment."
      />
      <UrlTabs
        tabs={[
          {
            value: "pending",
            label: "Pending",
            count: pending.length,
            content: (
              <PendingApprovalsTable
                org={org}
                data={pending.map((step) => ({
                  id: step.id,
                  title: step.request.title,
                  href: links.get(step.request.id) ?? `/${org}/approvals`,
                  documentType: step.request.documentType.replaceAll("_", " "),
                  stepName: step.name,
                  requestedBy: step.request.requestedBy.name,
                  amount:
                    step.request.amount != null
                      ? formatMoney(step.request.amount, ctx.org.baseCurrency)
                      : null,
                  createdAt: step.request.createdAt.toISOString(),
                }))}
              />
            ),
          },
          {
            value: "history",
            label: "Request history",
            count: history.length,
            content: (
              <>
                <p className="text-xs text-muted-foreground">
                  Showing up to 100 recent requests you can view.
                </p>
                <ApprovalHistoryTable
                  org={org}
                  data={history.map((request) => ({
                    id: request.id,
                    title: request.title,
                    href: links.get(request.id) ?? `/${org}/approvals`,
                    documentType: request.documentType.replaceAll("_", " "),
                    status: request.status,
                    requestedBy: request.requestedBy.name,
                    createdAt: request.createdAt.toISOString(),
                    canCancel:
                      request.status === "PENDING" &&
                      (ctx.isAdmin || request.requestedById === ctx.user.id),
                    steps: request.steps.map((step) => ({
                      id: step.id,
                      sequence: step.sequence,
                      name: step.name,
                      status: step.status,
                      actedBy: step.actedBy?.name ?? null,
                      comment: step.comment,
                    })),
                  }))}
                />
              </>
            ),
          },
        ]}
      />
    </>
  );
}
