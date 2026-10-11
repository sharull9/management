import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { projectUserOptions } from "@/modules/project/server/queries";

import { DeleteStageForm, StageForm } from "../components/stage-form";
export async function StagesView({
  org,
  projectId,
}: {
  org: string;
  projectId: string;
}) {
  const ctx = await requireProjectContext(org, projectId);
  const [stages, users] = await Promise.all([
    db.stage.findMany({
      where: { projectId },
      include: { manager: true },
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
    }),
    projectUserOptions(ctx.org.id),
  ]);
  const manage = ctx.isAdmin || ctx.permissions.has("stage.manage");
  return (
    <>
      <h2 className="text-lg font-medium">Stages</h2>
      <p className="text-sm text-muted-foreground">
        Stages run in sequence order. Edit the sequence to reorder.
      </p>
      <ItemGroup>
        {stages.map((s) => (
          <Item key={s.id} variant="outline">
            <ItemContent>
              <ItemTitle>
                {s.sequence}. {s.name}
              </ItemTitle>
              <div className="mb-4 flex gap-3 text-sm">
                <Badge variant="secondary">{s.status}</Badge>
                <span>{s.manager?.name ?? "No stage manager"}</span>
              </div>
              {manage && (
                <details>
                  <summary className="cursor-pointer text-sm">
                    Edit stage
                  </summary>
                  <div className="space-y-4 pt-4">
                    <StageForm
                      org={org}
                      projectId={projectId}
                      stage={{
                        id: s.id,
                        name: s.name,
                        sequence: s.sequence,
                        status: s.status,
                        managerUserId: s.managerUserId,
                        budgetAmount: s.budgetAmount?.toFixed(2) ?? "",
                        startDate:
                          s.startDate?.toISOString().slice(0, 10) ?? "",
                        endDate: s.endDate?.toISOString().slice(0, 10) ?? "",
                      }}
                      users={[
                        ...new Map(
                          [
                            ...users,
                            ...stages.flatMap((stage) =>
                              stage.manager
                                ? [
                                    {
                                      id: stage.manager.id,
                                      name: stage.manager.name,
                                    },
                                  ]
                                : [],
                            ),
                          ].map((user) => [user.id, user]),
                        ).values(),
                      ]}
                    />
                    <DeleteStageForm
                      org={org}
                      projectId={projectId}
                      id={s.id}
                    />
                  </div>
                </details>
              )}
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {!stages.length && <EmptyState title="No stages yet." />}
      {manage && (
        <FormCard title="Create stage">
          <StageForm
            org={org}
            projectId={projectId}
            users={[
              ...new Map(
                [
                  ...users,
                  ...stages.flatMap((stage) =>
                    stage.manager
                      ? [{ id: stage.manager.id, name: stage.manager.name }]
                      : [],
                  ),
                ].map((user) => [user.id, user]),
              ).values(),
            ]}
            nextSequence={(stages.at(-1)?.sequence ?? 0) + 1}
          />
        </FormCard>
      )}
    </>
  );
}
