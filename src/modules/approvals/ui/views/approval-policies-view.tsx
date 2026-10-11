import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { approvalPolicyData } from "../../server/queries";
import type { PolicyRow } from "../../type";
import { PoliciesTable } from "../components/policies-table";
import { PolicyEditor } from "../components/policy-editor";

export async function ApprovalPoliciesView({ org }: { org: string }) {
  const { policies } = await approvalPolicyData(org);
  const data: PolicyRow[] = policies.map((policy) => ({
    id: policy.id,
    name: policy.name,
    documentType: policy.documentType.replaceAll("_", " "),
    active: policy.active,
    stepCount: policy.steps.length,
    updatedAt: policy.updatedAt.toISOString(),
    scope: policy.stage?.name ?? policy.project?.name ?? "Organization default",
    draft: {
      id: policy.id,
      name: policy.name,
      documentType: policy.documentType,
      active: policy.active,
      scope: policy.stageId ? "stage" : policy.projectId ? "project" : "org",
      projectId: policy.projectId,
      stageId: policy.stageId,
      steps: policy.steps.map((step) => ({
        name: step.name,
        approverType: step.approverType,
        roleId: step.roleId,
        userId: step.userId,
        minAmount: step.minAmount?.toString() ?? "",
      })),
    },
    options: {
      projects: policy.project
        ? [{ value: policy.project.id, label: policy.project.name }]
        : [],
      stages: policy.stage
        ? [{ value: policy.stage.id, label: policy.stage.name }]
        : [],
      roles: Array.from(
        new Map(
          policy.steps
            .flatMap((step) =>
              step.role ? [{ value: step.role.id, label: step.role.name }] : [],
            )
            .map((option) => [option.value, option]),
        ).values(),
      ),
      users: Array.from(
        new Map(
          policy.steps
            .flatMap((step) =>
              step.user ? [{ value: step.user.id, label: step.user.name }] : [],
            )
            .map((option) => [option.value, option]),
        ).values(),
      ),
    },
  }));
  return (
    <>
      <PageHeading
        title="Approval policies"
        description="Steps run in order. Minimum amounts skip steps below the threshold. Requests keep a snapshot of the policy used when submitted."
      />
      <PoliciesTable org={org} data={data} />
      <FormCard title="Create policy">
        <PolicyEditor org={org} />
      </FormCard>
    </>
  );
}
