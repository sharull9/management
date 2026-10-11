import { EmptyState } from "@/components/shared/empty-state";
import { CreateSheet, SideSheet } from "@/components/shared/overlay/side-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
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
  const managerOptions = [
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
  ];
  return (
    <>
      <SectionHeader
        title="Stages"
        description="Stages run in sequence order. Edit the sequence to reorder."
        actions={
          manage && (
            <CreateSheet label="New stage">
              <StageForm
                org={org}
                projectId={projectId}
                users={managerOptions}
                nextSequence={(stages.at(-1)?.sequence ?? 0) + 1}
              />
            </CreateSheet>
          )
        }
      />
      <ItemGroup className="gap-2">
        {stages.map((s) => (
          <Item key={s.id} variant="outline" className="bg-card">
            <ItemMedia className="flex size-8 items-center justify-center rounded-md bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
              {s.sequence}
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{s.name}</ItemTitle>
              <ItemDescription>
                {s.manager?.name ?? "No stage manager"}
                {s.startDate &&
                  ` · ${s.startDate.toISOString().slice(0, 10)} → ${s.endDate?.toISOString().slice(0, 10) ?? "Open"}`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <StatusBadge status={s.status} />
              {manage && (
                <SideSheet
                  title={`Edit ${s.name}`}
                  trigger="Edit"
                  triggerVariant="outline"
                  triggerSize="sm"
                >
                  <div className="space-y-6">
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
                      users={managerOptions}
                    />
                    <Separator />
                    <DeleteStageForm
                      org={org}
                      projectId={projectId}
                      id={s.id}
                    />
                  </div>
                </SideSheet>
              )}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {!stages.length && <EmptyState title="No stages yet." />}
    </>
  );
}
