"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { designationInput, saveWorkerInput } from "../schema";
import { designation, saveWorker } from "./service";
export async function saveWorkerAction(
  org: string,
  input: z.input<typeof saveWorkerInput>,
) {
  return typedAction(saveWorkerInput, (parsed) => saveWorker(org, parsed))(
    input,
  );
}
export async function designationAction(
  org: string,
  input: z.input<typeof designationInput>,
) {
  return typedAction(designationInput, (parsed) => designation(org, parsed))(
    input,
  );
}
