import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { DocumentType } from "@/generated/prisma/enums";
import { savePolicyAction } from "../../server/actions";
import { approvalPolicyData } from "../../server/queries";
import { PolicyEditor } from "../components/policy-editor";

export async function ApprovalPoliciesView({ org }: { org: string }) {
  const { policies, roles, members, projects, stages } =
    await approvalPolicyData(org);
  return (
    <>
      <PageHeading
        title="Approval policies"
        description="Steps run in order. Minimum amounts skip steps below the threshold. Requests keep a snapshot of the policy used when submitted."
      />
      <div className="space-y-4">
        {policies.map((policy) => (
          <FormCard key={policy.id} title={policy.name}>
            <details>
              <summary className="cursor-pointer text-sm">
                {policy.documentType.replaceAll("_", " ")} ·{" "}
                {policy.active ? "Active" : "Inactive"} · {policy.steps.length}{" "}
                steps · Edit policy
              </summary>
              <div className="pt-6">
                <ActionForm action={savePolicyAction.bind(null, org)}>
                  <input type="hidden" name="id" value={policy.id} />
                  <Field
                    label="Policy name"
                    name="name"
                    defaultValue={policy.name}
                    required
                  />
                  <SelectField
                    label="Document type"
                    name="documentType"
                    defaultValue={policy.documentType}
                  >
                    {Object.values(DocumentType).map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </SelectField>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={policy.active}
                    />
                    Active
                  </label>
                  <PolicyEditor
                    projects={projects}
                    stages={stages}
                    initialProjectId={policy.projectId}
                    initialStageId={policy.stageId}
                    roles={roles}
                    users={members.map((m) => m.user)}
                    initialSteps={policy.steps.map((s) => ({
                      name: s.name,
                      approverType: s.approverType,
                      roleId: s.roleId,
                      userId: s.userId,
                      minAmount: s.minAmount?.toString() ?? null,
                    }))}
                  />
                </ActionForm>
              </div>
            </details>
          </FormCard>
        ))}
      </div>
      <FormCard title="Create policy">
        <ActionForm
          action={savePolicyAction.bind(null, org)}
          submit="Create policy"
        >
          <Field label="Policy name" name="name" required />
          <SelectField label="Document type" name="documentType">
            {Object.values(DocumentType).map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </SelectField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked />
            Active
          </label>
          <PolicyEditor
            projects={projects}
            stages={stages}
            roles={roles}
            users={members.map((m) => m.user)}
          />
        </ActionForm>
      </FormCard>
    </>
  );
}
