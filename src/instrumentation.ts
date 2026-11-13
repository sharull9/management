export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.WORKFLOW_TARGET_WORLD === "@workflow/world-postgres") {
    const { getWorld } = await import("workflow/runtime");
    await (await getWorld()).start?.();
  }
  const target = process.env.WORKFLOW_TARGET_WORLD;
  if (
    target === "@workflow/world-postgres" ||
    (process.env.NODE_ENV === "development" &&
      (!target || target === "@workflow/world-local"))
  ) {
    const { startApprovalReminderWorker } = await import(
      "./modules/approvals/server/reminder-worker"
    );
    startApprovalReminderWorker();
  }
}
