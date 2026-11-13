import "server-only";
import { dispatchApprovalReminders } from "./start-reminder";

type Worker = { timer?: ReturnType<typeof setTimeout>; stopped: boolean };
const state = globalThis as typeof globalThis & {
  __managementReminderWorker?: Worker;
};

export function stopApprovalReminderWorker() {
  if (!state.__managementReminderWorker) return;
  state.__managementReminderWorker.stopped = true;
  clearTimeout(state.__managementReminderWorker.timer);
  delete state.__managementReminderWorker;
}

export function startApprovalReminderWorker() {
  if (state.__managementReminderWorker) return;
  const worker: Worker = { stopped: false };
  state.__managementReminderWorker = worker;
  const tick = async () => {
    try {
      await dispatchApprovalReminders();
    } catch (error) {
      console.error("Approval reminder outbox poll failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    } finally {
      if (!worker.stopped) {
        worker.timer = setTimeout(tick, 30000);
        worker.timer.unref();
      }
    }
  };
  worker.timer = setTimeout(tick, 0);
  worker.timer.unref();
}
