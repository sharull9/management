"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { deleteInput, siteFormInput } from "../schema";
import { site } from "./site-service";
export async function siteAction(
  org: string,
  projectId: string,
  input: z.input<typeof siteFormInput>,
) {
  return typedAction(siteFormInput, async (parsed) =>
    site(org, projectId, parsed),
  )(input);
}
export async function deleteSiteAction(
  org: string,
  projectId: string,
  input: z.input<typeof deleteInput>,
) {
  return typedAction(deleteInput, async (parsed) =>
    site(org, projectId, parsed, true),
  )(input);
}
