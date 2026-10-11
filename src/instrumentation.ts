export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.WORKFLOW_TARGET_WORLD === "@workflow/world-postgres"
  ) {
    const { getWorld } = await import("workflow/runtime");
    await (await getWorld()).start?.();
  }
}
