import { PageHeading } from "@/components/shared/page-heading";
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
      <h2 className="text-lg font-medium">Your pending steps</h2>
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
              ? `${ctx.org.baseCurrency} ${step.request.amount.toFixed(2)}`
              : null,
          createdAt: step.request.createdAt.toISOString(),
        }))}
      />
      <h2 className="pt-4 text-lg font-medium">Request history</h2>
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
  );
}
