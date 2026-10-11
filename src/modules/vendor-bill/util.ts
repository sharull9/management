import type { z } from "zod";
import type { billFormInput } from "./schema";

// RHF owns all bill values. FormData transports their JSON plus the optional binary file.
export function billFormData(
  payload: Omit<z.input<typeof billFormInput>, "attachment">,
  attachment?: File | null,
) {
  const data = new FormData();
  data.set("payload", JSON.stringify(payload));
  if (attachment) data.set("attachment", attachment);
  return data;
}
