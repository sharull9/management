import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { FormCard } from "@/components/form-card";
import { PageHeading } from "@/components/page-heading";
import { PolicyEditor } from "@/components/policy-editor";
import { DocumentType } from "@/generated/prisma/enums";
import { savePolicyAction } from "@/server/actions";
import { assertPermission, requireOrgContext } from "@/server/context";
import { db } from "@/server/db";

async function PoliciesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "approval.policy.manage");
  const [policies, roles, members] = await Promise.all([
    db.approvalPolicy.findMany({
      where: { organizationId: ctx.org.id },
      include: { steps: { orderBy: { sequence: "asc" } } },
      orderBy: { documentType: "asc" },
    }),
    db.role.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true },
    }),
    db.member.findMany({
      where: { organizationId: ctx.org.id },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);
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
          <PolicyEditor roles={roles} users={members.map((m) => m.user)} />
        </ActionForm>
      </FormCard>
    </>
  );
}

export default function Page(props: Parameters<typeof PoliciesPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <PoliciesPage {...props} />
    </Suspense>
  );
}
