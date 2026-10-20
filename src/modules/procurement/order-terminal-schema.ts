import { z } from "zod";
import { id } from "@/core/schema";

export const orderTerminalInput = z.object({
  id,
  action: z.enum(["CLOSE", "CANCEL"]),
});
