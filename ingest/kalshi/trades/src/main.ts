/**
 * Kalshi trades batch downloader
 *
 * Fetches all historical trades from the public Kalshi API using cursor-based
 * pagination and archives them as gzip-compressed JSONL.
 */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createGzip } from "node:zlib";
import { requireEnv } from "@firm/common/env";
import type { TradesResponse } from "./types.js";

class Archive {
  private streams = new Map<string, NodeJS.WritableStream>();

  constructor(private dir: string) {}

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async writeline(key: string, message: string): Promise<void> {
    let stream = this.streams.get(key);
    if (!stream) {
      const filepath = `${this.dir}/${key}.jsonl.gz`;
      await mkdir(dirname(filepath), { recursive: true });
      const file = createWriteStream(filepath);
      const gzip = createGzip({ level: 6 });
      stream = gzip.pipe(file);
      this.streams.set(key, stream);
    }
    stream.write(`${message}\n`);
  }

  async flush(): Promise<void> {
    const promises = Array.from(this.streams.values()).map(
      (stream) =>
        new Promise<void>((resolve, reject) => {
          stream.once("error", reject);
          stream.once("finish", resolve);
          stream.end();
        }),
    );
    await Promise.all(promises);
    this.streams.clear();
  }
}

const API_URL = "https://api.elections.kalshi.com/trade-api/v2/markets/trades";

/**
 * Returns a timestamped directory name for this ingestion run
 */
function getTimestampedDir(baseDir: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace("T", "_").replace(/:/g, "-").replace("Z", "");
  return `${baseDir}/${timestamp}`;
}

async function main(): Promise<void> {
  const baseDir = requireEnv("KALSHI_TRADES_DIR");
  const timestampedDir = getTimestampedDir(baseDir);

  const archive = new Archive(timestampedDir);
  await archive.init();

  let cursor: string | undefined;
  let batchCount = 0;
  let totalTrades = 0;

  while (true) {
    const url = new URL(API_URL);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as TradesResponse;
    const trades = data.trades || [];

    for (const trade of trades) {
      await archive.writeline("trades", JSON.stringify(trade));
    }

    console.log(`Batch ${batchCount}: Fetched ${trades.length} trades`);
    batchCount++;
    totalTrades += trades.length;

    cursor = data.cursor;
    if (!cursor) {
      break;
    }
  }

  await archive.flush();
  console.log(`Completed. Total batches: ${batchCount}, total trades written: ${totalTrades}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
