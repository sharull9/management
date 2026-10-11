import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import { UrlTabs } from "@/components/shared/url-tabs";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { projectUserOptions } from "@/modules/project/server/queries";
import { rangesOverlap } from "@/modules/workforce/server/availability";
import { MemberForm, WorkerForm } from "../components/team-forms";
import { MembersTable, WorkersTable } from "../components/team-tables";
export async function TeamView({
  org,
  projectId,
}: {
  org: string;
  projectId: string;
}) {
  const ctx = await requireProjectContext(org, projectId);
  const [members, assignments, workers, users, roles] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId },
      include: { user: true, role: true },
    }),
    db.projectWorker.findMany({
      where: { projectId },
      include: {
        worker: { include: { projects: { include: { project: true } } } },
      },
      orderBy: { startDate: "asc" },
    }),
    db.worker.findMany({
      where: { organizationId: ctx.org.id, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    projectUserOptions(ctx.org.id),
    db.role.findMany({ where: { tenantId: ctx.tenant.id } }),
  ]);
  const manage = ctx.isAdmin || ctx.permissions.has("project.edit");
  return (
    <>
      <SectionHeader
        title="Project team"
        description="People with access to this project and the workers assigned to it."
      />
      <UrlTabs
        tabs={[
          {
            value: "members",
            label: "Members",
            count: members.length,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                  {manage && (
                    <CardAction>
                      <SideSheet
                        title="Add member"
                        trigger="Add member"
                        triggerIcon="plus"
                        triggerSize="sm"
                        width="md"
                      >
                        <MemberForm
                          org={org}
                          projectId={projectId}
                          users={users}
                          roles={roles.map((role) => ({
                            id: role.id,
                            name: role.name,
                          }))}
                        />
                      </SideSheet>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent>
                  <MembersTable
                    org={org}
                    projectId={projectId}
                    manage={manage}
                    data={members.map((member) => ({
                      id: member.id,
                      userId: member.userId,
                      name: member.user.name,
                      role: member.role?.name ?? "\u2014",
                      manager: member.isManager ? "Yes" : "No",
                    }))}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            value: "workers",
            label: "Worker assignments",
            count: assignments.length,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Worker assignments</CardTitle>
                  {manage && (
                    <CardAction>
                      <SideSheet
                        title="Assign worker"
                        trigger="Assign worker"
                        triggerIcon="plus"
                        triggerSize="sm"
                      >
                        <WorkerForm
                          org={org}
                          projectId={projectId}
                          workers={workers}
                        />
                      </SideSheet>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent>
                  <WorkersTable
                    org={org}
                    projectId={projectId}
                    manage={manage}
                    data={assignments.map((assignment) => {
                      const overlaps = assignment.worker.projects.filter(
                        (other) =>
                          other.id !== assignment.id &&
                          rangesOverlap(assignment, other),
                      );
                      return {
                        id: assignment.id,
                        workerId: assignment.workerId,
                        name: assignment.worker.name,
                        startDate: assignment.startDate
                          .toISOString()
                          .slice(0, 10),
                        endDate:
                          assignment.endDate?.toISOString().slice(0, 10) ?? "",
                        dayRateOverride:
                          assignment.dayRateOverride?.toString() ?? "",
                        otHourlyRateOverride:
                          assignment.otHourlyRateOverride?.toString() ?? "",
                        notes: assignment.notes ?? "",
                        confirmOverlap: false,
                        availability: overlaps.length
                          ? `${overlaps.length} overlapping assignment(s)`
                          : "Available",
                      };
                    })}
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
