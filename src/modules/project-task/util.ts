import type { z } from "zod";
import { dateValue } from "@/components/shared/form/date-value";
import type { Task } from "@/generated/prisma/client";
import type { saveTaskInput } from "./schema";
export function taskFormValues(task: Task): z.input<typeof saveTaskInput> {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    stageId: task.stageId,
    priority: task.priority,
    status: task.status as "TODO" | "IN_PROGRESS" | "REWORK" | "CANCELLED",
    progressPercent: task.progressPercent,
    plannedStart: dateValue(task.plannedStart),
    dueDate: dateValue(task.dueDate),
    estimatedHours: task.estimatedHours?.toString() ?? "",
  };
}
