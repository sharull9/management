import type { entities } from "./schema";
import type { masterData } from "./server/queries";
export type MasterData = Awaited<ReturnType<typeof masterData>>;
export type MasterKind = (typeof entities)[number];
