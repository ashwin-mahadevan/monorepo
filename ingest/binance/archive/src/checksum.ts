/**
 * SHA256 checksum verification
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

/**
 * Verifies SHA256 checksum for a downloaded file
 * Returns true if verified (and deletes checksum file), false if data file missing
 */
export async function verified(url: string, ingestDir: string): Promise<boolean> {
  const filename = url.split("/").pop()!;
  const subdir = url.includes("-1s-") ? "klines" : "trades";
  const checksumPath = join(ingestDir, subdir, `${filename}.CHECKSUM`);
  const dataPath = join(ingestDir, subdir, filename);

  if (!existsSync(checksumPath)) {
    throw new Error(`missing checksum file: ${subdir}/${filename}.CHECKSUM`);
  }

  if (!existsSync(dataPath)) {
    return false;
  }

  const checksumText = await readFile(checksumPath, "utf-8");
  const expected = checksumText.split(/\s+/)[0];

  const data = await readFile(dataPath);
  const actual = createHash("sha256").update(data).digest("hex");

  if (actual === expected) {
    await unlink(checksumPath);
    return true;
  }

  return false;
}
