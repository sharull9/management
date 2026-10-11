"use client";

import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox";
import {
  ActionFormShell,
  TextareaField,
  useZodForm,
} from "@/components/shared/form";
import { approvalDecisionInput, cancelApprovalInput } from "../../schema";
import {
  approvalDecisionAction,
  cancelApprovalAction,
} from "../../server/actions";

const decisions = [
  { value: "APPROVE", label: "Approve" },
  { value: "REJECT", label: "Reject" },
];

export function ApprovalDecisionForm({
  org,
  stepId,
}: {
  org: string;
  stepId: string;
}) {
  const form = useZodForm<
    z.input<typeof approvalDecisionInput>,
    z.output<typeof approvalDecisionInput>
  >(approvalDecisionInput, {
    stepId,
    action: "APPROVE",
    comment: "",
  });
  return (
    <ActionFormShell
      form={form}
      action={approvalDecisionAction.bind(null, org)}
      submit="Submit decision"
    >
      <ComboboxField
        control={form.control}
        name="action"
        label="Decision"
        options={decisions}
      />
      <TextareaField
        control={form.control}
        name="comment"
        label="Comment (required for rejection)"
        maxLength={2000}
      />
    </ActionFormShell>
  );
}

export function CancelApprovalForm({
  org,
  requestId,
}: {
  org: string;
  requestId: string;
}) {
  const form = useZodForm(cancelApprovalInput, { id: requestId });
  return (
    <ActionFormShell
      form={form}
      action={cancelApprovalAction.bind(null, org)}
      submit="Cancel request"
      destructive
    >
      {null}
    </ActionFormShell>
  );
}
