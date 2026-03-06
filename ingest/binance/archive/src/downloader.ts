/**
 * curl --parallel wrapper for concurrent downloads
 */

import { spawn } from "node:child_process";

/**
 * Downloads multiple files concurrently using curl --parallel
 */
export async function curlParallel(
  urlToPath: Map<string, string>,
  concurrency: number,
): Promise<void> {
  const args = [
    "--parallel",
    "--parallel-max",
    concurrency.toString(),
    "--fail",
    "--location",
    "--silent",
    "--show-error",
    "--create-dirs",
  ];

  for (const [url, path] of urlToPath) {
    args.push("--output", path, url);
  }

  const proc = spawn("curl", args, { stdio: "inherit" });
  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`curl failed with exit code ${exitCode}`);
  }
}
