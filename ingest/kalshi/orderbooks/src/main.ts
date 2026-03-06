/**
 * Kalshi orderbooks real-time streaming ingestion
 *
 * Connects to Kalshi WebSocket API with RSA-SHA256 authentication.
 * Subscribes to trade channel, dynamically subscribes to orderbook_delta
 * for new tickers, and archives orderbook messages as gzip-compressed JSONL.
 */

import { constants, createPrivateKey, sign } from "node:crypto";
import { createWriteStream, mkdirSync } from "node:fs";
import { createGzip } from "node:zlib";
import { requireEnv } from "@firm/common/env";
import WebSocket from "ws";

function onShutdown(handler: () => Promise<void>): void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      try {
        await handler();
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    });
  }
}
import type { Archive } from "./websocket.js";
import { KalshiIngest } from "./websocket.js";

const WEBSOCKET_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2";
const WEBSOCKET_PATH = "/trade-api/ws/v2";
const MARKETS_URL = "https://api.elections.kalshi.com/trade-api/v2/markets";

const KALSHI_ID = requireEnv("KALSHI_ID");
const KALSHI_KEY = requireEnv("KALSHI_KEY");

/**
 * Creates an authenticated WebSocket connection to Kalshi API
 * Uses RSA-SHA256 with PSS padding (MGF1-SHA256, salt=digest size)
 * @returns Promise that resolves with the connected WebSocket
 */
async function connect(): Promise<WebSocket> {
  const timestamp = `${Date.now()}`;

  const signature = sign("sha256", Buffer.from(timestamp + "GET" + WEBSOCKET_PATH), {
    key: createPrivateKey({ key: KALSHI_KEY }),
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString("base64");

  const headers = {
    "KALSHI-ACCESS-KEY": KALSHI_ID,
    "KALSHI-ACCESS-SIGNATURE": signature,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
  };

  const ws = new WebSocket(WEBSOCKET_URL, { headers });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  return ws;
}

/**
 * Fetches open market tickers from the Kalshi REST API, yielding each page
 * as it arrives. Waits 1 second between pages to avoid rate limiting (529).
 */
async function* fetchActiveMarkets(): AsyncGenerator<string[]> {
  let cursor: string | undefined;

  while (true) {
    const url = new URL(MARKETS_URL);
    url.searchParams.set("status", "open");
    url.searchParams.set("limit", "1000");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      markets: { ticker: string }[];
      cursor?: string;
    };
    yield data.markets.map((m) => m.ticker);

    cursor = data.cursor;
    if (!cursor) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// --- Stream management ---

const IDLE_TIMEOUT_MS = 60_000;

interface StreamState {
  stream: NodeJS.WritableStream;
  written: number;
  lastMessageTime: number;
}
const activeStreams = new Map<string, StreamState>();

function openStream(baseDir: string, key: string): StreamState {
  const dir = `${baseDir}/${key}`;
  mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace("T", "_").replace(/:/g, "-").replace("Z", "");
  const file = createWriteStream(`${dir}/${timestamp}.jsonl.gz`);
  const gzip = createGzip({ level: 6 });
  const stream = gzip.pipe(file);
  return { stream, written: 0, lastMessageTime: Date.now() };
}

function writemessage(
  baseDir: string,
  series: string,
  event: string,
  market: string,
  message: string,
): void {
  const key = `${series}/${event}/${market}`;
  let state = activeStreams.get(key);
  if (!state) {
    state = openStream(baseDir, key);
    activeStreams.set(key, state);
  }
  state.stream.write(message + "\n");
  state.written++;
  state.lastMessageTime = Date.now();
}

function logRate(): void {
  const oneMinuteAgo = Date.now() - 60_000;
  const active = [...activeStreams.entries()].filter(([, s]) => s.lastMessageTime >= oneMinuteAgo);
  if (active.length === 0) {
    console.log("No active tickers in the last minute.");
    return;
  }
  const total = active.reduce((n, [, s]) => n + s.written, 0);
  console.log(`Activity (${active.length} tickers): ${total} messages`);
  for (const [, s] of active) s.written = 0;
}

async function closeStream(key: string): Promise<void> {
  const state = activeStreams.get(key);
  if (!state) return;
  await new Promise<void>((resolve, reject) => {
    state.stream.once("error", reject);
    state.stream.once("finish", resolve);
    state.stream.end();
  });
  activeStreams.delete(key);
}

async function flushAll(): Promise<void> {
  await Promise.all([...activeStreams.keys()].map(closeStream));
}

async function checkIdleStreams(): Promise<void> {
  const threshold = Date.now() - IDLE_TIMEOUT_MS;
  const idle = [...activeStreams.entries()]
    .filter(([, s]) => s.lastMessageTime < threshold)
    .map(([k]) => k);
  await Promise.all(idle.map(closeStream));
}

// --- Startup ---

const baseDir = requireEnv("KALSHI_INGEST_DIR");

// Collect all active markets (excluding KXMVE parlays)
const allTickers: string[] = [];
for await (const page of fetchActiveMarkets()) {
  for (const ticker of page) {
    if (ticker.startsWith("KXMVE")) continue;
    allTickers.push(ticker);
  }
}
console.log(`Found ${allTickers.length} active markets.`);

// Archive adapter for KalshiIngest — routes writeline through writemessage
function makeArchiveAdapter(): Archive {
  return {
    writeline: (ticker: string, message: string) => {
      const parts = ticker.split("-");
      const series = parts[0];
      const event = parts[1] ?? "";
      const market = parts.slice(2).join("-");
      writemessage(baseDir, series, event, market, message);
    },
    logRate: () => {},
    flush: flushAll,
  };
}

// Shard markets into groups of MAX_MARKETS_PER_SHARD
const MAX_MARKETS_PER_SHARD = 10_000;
const shards: string[][] = [];
for (let i = 0; i < allTickers.length; i += MAX_MARKETS_PER_SHARD) {
  shards.push(allTickers.slice(i, i + MAX_MARKETS_PER_SHARD));
}
console.log(`Sharding into ${shards.length} WebSocket connections.`);

// Connect in batches to stay within Kalshi's 10 req/s rate limit
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
const apps: KalshiIngest[] = [];

for (let i = 0; i < shards.length; i += BATCH_SIZE) {
  const batch = shards.slice(i, i + BATCH_SIZE);
  await Promise.all(
    batch.map(async (tickers) => {
      const ws = await connect();
      const app = new KalshiIngest(ws, makeArchiveAdapter());
      app.seedTickers(tickers);
      apps.push(app);
    }),
  );
  if (i + BATCH_SIZE < shards.length) {
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }
  console.log(`Connected ${Math.min(i + BATCH_SIZE, shards.length)}/${shards.length} shards.`);
}

const rateLogInterval = setInterval(logRate, 60_000);
const idleCheckInterval = setInterval(() => {
  checkIdleStreams().catch(console.error);
}, 60_000);

onShutdown(async () => {
  clearInterval(rateLogInterval);
  clearInterval(idleCheckInterval);
  await Promise.all(apps.map((app) => app.shutdown()));
  await flushAll();
});

await Promise.all(apps.map((app) => app.run()));

// Keep process alive until shutdown signal
await new Promise(() => {});
