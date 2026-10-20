import { UserFacingError } from "@/core/errors";
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "storage");
function filePath(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key))
    throw new UserFacingError("Invalid storage key.");
  return path.join(root, key);
}
export const storage = {
  async put(bytes: Uint8Array) {
    if (bytes.byteLength > 20 * 1024 * 1024)
      throw new UserFacingError("Attachments must be 20 MB or smaller.");
    await mkdir(root, { recursive: true });
    const key = randomUUID();
    await writeFile(filePath(key), bytes, { flag: "wx" });
    return key;
  },
  get: (key: string) => readFile(filePath(key)),
  delete: (key: string) => unlink(filePath(key)),
};
