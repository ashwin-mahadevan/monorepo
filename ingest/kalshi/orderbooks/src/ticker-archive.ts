/**
 * Per-ticker archive with activity-based file segmentation
 *
 * Each ticker gets its own directory. Files are automatically closed after
 * 1 minute of inactivity, with new files created when activity resumes.
 */

import { createWriteStream, mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createGzip } from "node:zlib";

interface TickerState {
  stream: NodeJS.WritableStream; // gzip → file pipeline
  written: number; // Messages written to current file
  fileTimestamp: Date; // When current file was created
  lastMessageTime: number; // Date.now() of last message
  tickerDir: string; // {baseDir}/{ticker}/
}

export class TickerArchive {
  private tickers = new Map<string, TickerState>();
  private checkIdleInterval: NodeJS.Timeout | null = null;

  private static readonly IDLE_TIMEOUT_MS = 60_000;
  private static readonly CHECK_INTERVAL_MS = 60_000;

  constructor(private baseDir: string) {}

  /**
   * Initialize the archive: create base directory and start idle checker
   */
  async init(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    this.checkIdleInterval = setInterval(() => {
      this.checkAndFlushIdleTickers().catch((error) => {
        console.error("Error checking idle tickers:", error);
      });
    }, TickerArchive.CHECK_INTERVAL_MS);
  }

  /**
   * Write a message to a ticker's archive
   */
  writeline(ticker: string, message: string): void {
    let state = this.tickers.get(ticker);
    if (!state) {
      state = this.initializeTickerSync(ticker);
      this.tickers.set(ticker, state);
    }
    state.stream.write(message + "\n");
    state.written++;
    state.lastMessageTime = Date.now();
  }

  /**
   * Initialize a new ticker: create directory and file stream
   */
  private initializeTickerSync(ticker: string): TickerState {
    const tickerDir = `${this.baseDir}/${ticker}`;
    mkdirSync(tickerDir, { recursive: true });

    const now = new Date();
    const timestamp = now.toISOString().replace("T", "_").replace(/:/g, "-").replace("Z", "");
    const filepath = `${tickerDir}/${timestamp}.jsonl.gz`;

    const file = createWriteStream(filepath);
    const gzip = createGzip({ level: 6 });
    const stream = gzip.pipe(file);

    return {
      stream,
      written: 0,
      fileTimestamp: now,
      lastMessageTime: Date.now(),
      tickerDir,
    };
  }

  /**
   * Log per-ticker activity over the last minute
   */
  logRate(): void {
    const oneMinuteAgo = Date.now() - 60_000;
    const activeTickers = Array.from(this.tickers.entries())
      .filter(([_, state]) => state.lastMessageTime >= oneMinuteAgo)
      .sort(([a], [b]) => a.localeCompare(b));

    if (activeTickers.length === 0) {
      console.log("No active tickers in the last minute.");
      return;
    }

    const total = activeTickers.reduce((sum, [_, state]) => sum + state.written, 0);

    console.log(`Activity in the last minute (${activeTickers.length} tickers):`);
    for (const [ticker, state] of activeTickers) {
      console.log(`  ${ticker}: ${state.written} messages`);
    }
    console.log(`Total: ${total} messages across ${activeTickers.length} tickers`);

    // Reset counters
    for (const [_, state] of activeTickers) {
      state.written = 0;
    }
  }

  /**
   * Check for idle tickers and flush them
   */
  private async checkAndFlushIdleTickers(): Promise<void> {
    const idleThreshold = Date.now() - TickerArchive.IDLE_TIMEOUT_MS;
    const idleTickers = Array.from(this.tickers.entries())
      .filter(([_, state]) => state.lastMessageTime < idleThreshold)
      .map(([ticker]) => ticker);

    if (idleTickers.length === 0) {
      return;
    }

    console.log(`Flushing ${idleTickers.length} idle tickers: ${idleTickers.join(", ")}`);
    await Promise.all(idleTickers.map((ticker) => this.flushTicker(ticker)));
    console.log(`Flushed ${idleTickers.length} idle tickers.`);
  }

  /**
   * Flush a single ticker's stream
   */
  private async flushTicker(ticker: string): Promise<void> {
    const state = this.tickers.get(ticker);
    if (!state) {
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        state.stream.once("error", reject);
        state.stream.once("finish", resolve);
        state.stream.end();
      });
      this.tickers.delete(ticker);
    } catch (error) {
      console.error(`Error flushing ticker ${ticker}:`, error);
      // Keep in map to retry next interval
      throw error;
    }
  }

  /**
   * Flush all active tickers (called on shutdown)
   */
  async flush(): Promise<void> {
    if (this.checkIdleInterval) {
      clearInterval(this.checkIdleInterval);
      this.checkIdleInterval = null;
    }

    const allTickers = Array.from(this.tickers.keys());
    if (allTickers.length === 0) {
      return;
    }

    console.log(`Flushing ${allTickers.length} active tickers...`);
    await Promise.all(allTickers.map((ticker) => this.flushTicker(ticker)));
    console.log(`Flushed ${allTickers.length} active tickers.`);
  }
}
