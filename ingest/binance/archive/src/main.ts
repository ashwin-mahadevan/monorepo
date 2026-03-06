/**
 * Binance historical data downloader
 *
 * Downloads KLINE (1s) and aggregated trades data from Binance Vision API
 * for BTCUSDT, ETHUSDT, SOLUSDT. Fetches monthly files first, then daily files.
 * Verifies SHA256 checksums and retries missing files.
 */

import { join } from "node:path";
import { requireEnv, requireInt } from "@firm/common/env";
import { verified } from "./checksum.js";
import { curlParallel } from "./downloader.js";
import { SYMBOL_STARTS, type Symbol } from "./types.js";
import { klineUrl, tradeUrl } from "./urls.js";

/**
 * Parse optional date from environment, or use default
 */
function getDate(envVar: string, defaultValue: Date): Date {
  const value = process.env[envVar];
  return value ? new Date(value) : defaultValue;
}

/**
 * Returns yesterday's date
 */
function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Adds one month to a date
 */
function addMonth(d: Date): Date {
  const year = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  const month = d.getMonth() === 11 ? 0 : d.getMonth() + 1;
  return new Date(year, month, d.getDate());
}

/**
 * Adds one day to a date
 */
function addDay(d: Date): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + 1);
  return result;
}

/**
 * Compares (year, month) tuples
 */
function monthLessThan(a: Date, b: Date): boolean {
  return (
    a.getFullYear() < b.getFullYear() ||
    (a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth())
  );
}

/**
 * Returns the subdirectory (klines or trades) for a given URL
 */
function getSubdir(url: string): string {
  return url.includes("-1s-") ? "klines" : "trades";
}

/**
 * Returns the full path for a file based on its URL
 */
function getFilePath(url: string, ingestDir: string): string {
  const filename = url.split("/").pop()!;
  const subdir = getSubdir(url);
  return join(ingestDir, subdir, filename);
}

async function main(): Promise<void> {
  const ingestDir = requireEnv("BINANCE_INGEST_DIR");
  const concurrency = requireInt("CURL_CONCURRENCY");
  const startDate = getDate("START_DATE", new Date(0)); // Unix epoch
  const endDate = getDate("END_DATE", yesterday());

  if (startDate >= endDate) {
    throw new Error("START_DATE must be before END_DATE");
  }

  const urls = new Set<string>();

  // Generate URLs for each symbol
  for (const symbol of Object.keys(SYMBOL_STARTS) as Symbol[]) {
    let current = new Date(Math.max(SYMBOL_STARTS[symbol].getTime(), startDate.getTime()));

    // Monthly files
    while (monthLessThan(current, endDate)) {
      urls.add(klineUrl(symbol, current.getFullYear(), current.getMonth() + 1));
      urls.add(tradeUrl(symbol, current.getFullYear(), current.getMonth() + 1));
      current = addMonth(current);
    }

    // Daily files
    while (current < endDate) {
      urls.add(klineUrl(symbol, current.getFullYear(), current.getMonth() + 1, current.getDate()));
      urls.add(tradeUrl(symbol, current.getFullYear(), current.getMonth() + 1, current.getDate()));
      current = addDay(current);
    }
  }

  // Download all checksums first
  const checksumUrls = new Map<string, string>();
  for (const url of urls) {
    checksumUrls.set(`${url}.CHECKSUM`, `${getFilePath(url, ingestDir)}.CHECKSUM`);
  }
  await curlParallel(checksumUrls, concurrency);

  // Download and verify data files (with retry loop)
  let missing = new Set<string>();
  for (const url of urls) {
    if (!(await verified(url, ingestDir))) {
      missing.add(url);
    }
  }

  while (missing.size > 0) {
    console.log(`Downloading ${missing.size} missing files...`);
    const downloads = new Map<string, string>();
    for (const url of missing) {
      downloads.set(url, getFilePath(url, ingestDir));
    }
    await curlParallel(downloads, concurrency);

    // Re-verify
    const stillMissing = new Set<string>();
    for (const url of missing) {
      if (!(await verified(url, ingestDir))) {
        stillMissing.add(url);
      }
    }
    missing = stillMissing;
  }

  console.log("All files downloaded and verified successfully!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
