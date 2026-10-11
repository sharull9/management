"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { attendanceInput } from "../schema";
import { attendance } from "./service";
export async function attendanceAction(
  org: string,
  projectId: string,
  input: z.input<typeof attendanceInput>,
) {
  return typedAction(attendanceInput, (parsed) =>
    attendance(org, projectId, parsed),
  )(input);
}
