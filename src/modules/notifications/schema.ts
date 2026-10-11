import { z } from "zod";

export const notificationScope = z.object({
  orgSlug: z.string().min(1).max(200),
});
export const markNotificationReadInput = notificationScope.extend({
  id: z.string().min(1).max(500),
});
