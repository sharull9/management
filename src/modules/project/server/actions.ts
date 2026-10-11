"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { projectFormInput } from "../schema";
import { saveProject } from "./service";
export async function saveProjectAction(
  org: string,
  input: z.input<typeof projectFormInput>,
) {
  return typedAction(projectFormInput, async (parsed) =>
    saveProject(org, parsed),
  )(input);
}
