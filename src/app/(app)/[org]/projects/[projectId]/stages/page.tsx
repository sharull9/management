import { Suspense } from "react";
import { StageForm } from "@/components/project-forms";
import { ActionForm } from "@/components/shared/action-form";
import { FormCard } from "@/components/shared/form-card";
import Loading from "@/components/shared/page-loading";
import { Badge } from "@/components/ui/badge";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { deleteStageAction } from "@/server/projects/actions";
import { projectUsers } from "@/server/projects/queries";

async function Stages({
  params,
}: {
  params: Promise<{ org: string; projectId: string }>;
}) {
  const { org, projectId } = await params;
  const ctx = await requireProjectContext(org, projectId);
  const [stages, users] = await Promise.all([
    db.stage.findMany({
      where: { projectId },
      include: { manager: true },
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
    }),
    projectUsers(ctx.org.id),
  ]);
  const manage = ctx.isAdmin || ctx.permissions.has("stage.manage");
  return (
    <>
      <h2 className="text-lg font-medium">Stages</h2>
      <p className="text-sm text-muted-foreground">
        Stages run in sequence order. Edit the sequence to reorder.
      </p>
      {stages.map((s) => (
        <FormCard key={s.id} title={`${s.sequence}. ${s.name}`}>
          <div className="mb-4 flex gap-3 text-sm">
            <Badge variant="secondary">{s.status}</Badge>
            <span>{s.manager?.name ?? "No stage manager"}</span>
          </div>
          {manage && (
            <details>
              <summary className="cursor-pointer text-sm">Edit stage</summary>
              <div className="space-y-4 pt-4">
                <StageForm
                  org={org}
                  projectId={projectId}
                  stage={s}
                  users={users}
                />
                <ActionForm
                  action={deleteStageAction.bind(null, org, projectId)}
                  submit="Delete stage"
                  destructive
                >
                  <input type="hidden" name="id" value={s.id} />
                  <p className="text-xs text-muted-foreground">
                    Referenced stages cannot be deleted.
                  </p>
                </ActionForm>
              </div>
            </details>
          )}
        </FormCard>
      ))}
      {!stages.length && (
        <p className="text-sm text-muted-foreground">No stages yet.</p>
      )}
      {manage && (
        <FormCard title="Create stage">
          <StageForm
            org={org}
            projectId={projectId}
            users={users}
            nextSequence={(stages.at(-1)?.sequence ?? 0) + 1}
          />
        </FormCard>
      )}
    </>
  );
}
export default function Page(props: Parameters<typeof Stages>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Stages {...props} />
    </Suspense>
  );
}
