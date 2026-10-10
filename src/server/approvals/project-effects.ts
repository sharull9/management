export function submissionTaskEffect(approved: boolean, now: Date) {
  return approved
    ? { status: "COMPLETED" as const, progressPercent: 100, completedAt: now }
    : { status: "REWORK" as const, completedAt: null };
}
export function managerApprovers(
  type: "PROJECT_MANAGER" | "STAGE_MANAGER",
  projectManagerId: string | null,
  memberManagerIds: string[],
  stageManagerId?: string | null,
) {
  const ids =
    type === "STAGE_MANAGER"
      ? stageManagerId
        ? [stageManagerId]
        : []
      : [projectManagerId, ...memberManagerIds].filter(
          (id): id is string => !!id,
        );
  return ids.length ? [...new Set(ids)] : null;
}
