"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import {
  memberInput,
  removeMemberInput,
  removeWorkerInput,
  workerInput,
} from "../schema";
import { team } from "./service";
export async function teamAction(
  org: string,
  projectId: string,
  input: z.input<typeof memberInput>,
) {
  return typedAction(memberInput, async (parsed) =>
    team(org, projectId, { ...parsed, operation: "MEMBER" }),
  )(input);
}
export async function removeMemberAction(
  org: string,
  projectId: string,
  input: z.input<typeof removeMemberInput>,
) {
  return typedAction(removeMemberInput, async (parsed) =>
    team(org, projectId, { ...parsed, operation: "REMOVE_MEMBER" }),
  )(input);
}
export async function saveWorkerAction(
  org: string,
  projectId: string,
  input: z.input<typeof workerInput>,
) {
  return typedAction(workerInput, async (parsed) =>
    team(org, projectId, { ...parsed, operation: "WORKER" }),
  )(input);
}
export async function removeWorkerAction(
  org: string,
  projectId: string,
  input: z.input<typeof removeWorkerInput>,
) {
  return typedAction(removeWorkerInput, async (parsed) =>
    team(org, projectId, { ...parsed, operation: "REMOVE_WORKER" }),
  )(input);
}
