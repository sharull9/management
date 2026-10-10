import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import {
  approvalDecisionAction,
  cancelApprovalAction,
} from "../../server/actions";
import { approvalInbox } from "../../server/queries";

export async function ApprovalsView({ org }: { org: string }) {
  const { ctx, pending, history, links } = await approvalInbox(org);
  return (
    <>
      <PageHeading
        title="Approvals"
        description="Review project work, expenses, procurement and stock transfers. Rejections require a comment."
      />
      <h2 className="text-lg font-medium">Your pending steps</h2>
      {pending.length === 0 && (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          You have no pending approval steps.
        </p>
      )}
      <div className="space-y-4">
        {pending.map((step) => (
          <FormCard key={step.id} title={step.request.title}>
            <Link
              className="mb-4 inline-block text-sm underline"
              href={links.get(step.request.id) ?? `/${org}/approvals`}
            >
              Open document
            </Link>
            <p className="mb-4 text-sm text-muted-foreground">
              {step.request.documentType.replaceAll("_", " ")} · {step.name} ·
              Requested by {step.request.requestedBy.name}
              {step.request.amount != null
                ? ` · ${ctx.org.baseCurrency} ${step.request.amount.toFixed(2)}`
                : ""}
            </p>
            <ActionForm
              action={approvalDecisionAction.bind(null, org)}
              submit="Submit decision"
            >
              <input type="hidden" name="stepId" value={step.id} />
              <SelectField label="Decision" name="action">
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
              </SelectField>
              <Field
                label="Comment (required for rejection)"
                name="comment"
                maxLength={2000}
              />
            </ActionForm>
          </FormCard>
        ))}
      </div>
      <h2 className="pt-4 text-lg font-medium">Request history</h2>
      <p className="text-xs text-muted-foreground">
        Showing up to 100 recent requests you can view.
      </p>
      <div className="space-y-4">
        {history.map((request) => (
          <FormCard key={request.id} title={request.title}>
            <Link
              className="mb-4 inline-block text-sm underline"
              href={links.get(request.id) ?? `/${org}/approvals`}
            >
              Open document
            </Link>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">{request.status}</Badge>
              <span className="text-muted-foreground">
                {request.documentType.replaceAll("_", " ")} ·{" "}
                {request.requestedBy.name} ·{" "}
                {request.createdAt.toLocaleDateString("en-IN")}
              </span>
            </div>
            <ol className="space-y-3">
              {request.steps.map((step) => (
                <li
                  key={step.id}
                  className="rounded-md bg-muted/50 p-3 text-sm"
                >
                  <p>
                    {step.sequence}. {step.name} · {step.status}
                    {step.actedBy ? ` · ${step.actedBy.name}` : ""}
                  </p>
                  {step.comment && (
                    <p className="mt-1 break-words text-muted-foreground">
                      {step.comment}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {request.status === "PENDING" &&
              (ctx.isAdmin || request.requestedById === ctx.user.id) && (
                <div className="mt-4">
                  <ActionForm
                    action={cancelApprovalAction.bind(null, org)}
                    submit="Cancel request"
                    destructive
                  >
                    <input type="hidden" name="id" value={request.id} />
                  </ActionForm>
                </div>
              )}
          </FormCard>
        ))}
      </div>
      {!history.length && (
        <p className="text-sm text-muted-foreground">
          No approval requests yet.
        </p>
      )}
    </>
  );
}
