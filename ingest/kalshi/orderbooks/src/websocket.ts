/**
 * Kalshi WebSocket client with subscription management
 */

import type WebSocket from "ws";
import type { OrderbookMessage, TradeMessage, WsCommand, WsResponse } from "./types.js";

export interface Archive {
  writeline: (ticker: string, message: string) => void;
  logRate: () => void;
  flush: () => Promise<void>;
}

/**
 * Manages Kalshi WebSocket connection, subscriptions, and message routing
 */
export class KalshiIngest {
  private commandId = 1;
  private callbacks = new Map<
    number,
    { resolve: (value: WsResponse) => void; reject: (error: Error) => void }
  >();
  private seen = new Set<string>();
  private subscribed = new Set<string>();
  private bookSid: number | null = null;
  private stopRequested = false;

  // Task handles
  private resubscribeInterval: NodeJS.Timeout | null = null;
  private rateLogInterval: NodeJS.Timeout | null = null;

  constructor(
    private ws: WebSocket,
    private archive: Archive,
  ) {}

  /**
   * Pre-seeds the seen set with known tickers before the WebSocket loop starts
   */
  seedTickers(tickers: string[]): void {
    for (const ticker of tickers) {
      this.seen.add(ticker);
    }
  }

  /**
   * Sends a command and waits for response
   */
  private async send(cmd: string, params: Record<string, unknown>): Promise<WsResponse> {
    const messageId = this.commandId++;
    const payload: WsCommand = { id: messageId, cmd, params };

    return new Promise<WsResponse>((resolve, reject) => {
      this.callbacks.set(messageId, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  /**
   * Handles incoming WebSocket messages
   */
  private receive(raw: string): void {
    const parsed = JSON.parse(raw) as WsResponse;
    const messageType = parsed.type;

    // Command responses
    if (messageType === "subscribed" || messageType === "ok") {
      const callback = this.callbacks.get(parsed.id!);
      if (!callback) {
        throw new Error(`Missing callback for command ${parsed.id}`);
      }
      this.callbacks.delete(parsed.id!);
      callback.resolve(parsed);
      return;
    }

    // Trade messages (add to seen set)
    if (messageType === "trade") {
      const trade = parsed as unknown as TradeMessage;
      this.seen.add(trade.msg.market_ticker);
      return;
    }

    // Orderbook messages (archive)
    if (messageType === "orderbook_snapshot" || messageType === "orderbook_delta") {
      const orderbook = parsed as unknown as OrderbookMessage;
      this.archive.writeline(orderbook.msg.market_ticker, raw.trim());
      return;
    }

    if (messageType === "unsubscribed") {
      console.warn("Received unsubscribed — clearing subscription state to retry", parsed);
      this.bookSid = null;
      this.subscribed.clear();
      return;
    }

    console.log(parsed);
    throw new Error(`Unexpected message type: ${messageType}`);
  }

  /**
   * Subscribes to a channel
   */
  private async subscribe(channel: string, tickers?: string[]): Promise<number> {
    const response = await this.send("subscribe", {
      channels: [channel],
      market_tickers: tickers ?? null,
    });

    const msg = response.msg;
    const sid = typeof msg === "object" && msg !== null ? (msg.sid as number) : undefined;

    if (
      response.type !== "subscribed" ||
      typeof msg !== "object" ||
      msg === null ||
      msg.channel !== channel ||
      typeof sid !== "number" ||
      sid <= 0
    ) {
      console.log(response);
      throw new Error("Failed to subscribe");
    }

    return sid;
  }

  /**
   * Adds markets to an existing subscription
   */
  private async addMarkets(sid: number, tickers: string[]): Promise<void> {
    if (sid <= 0) {
      throw new Error(`Invalid subscription ID: ${sid}. Must be positive.`);
    }
    if (tickers.length === 0) {
      return;
    }

    const response = await this.send("update_subscription", {
      sid,
      market_tickers: tickers,
      action: "add_markets",
    });

    if (response.type !== "ok" || typeof response.msg !== "object") {
      console.log(response);
      throw new Error("Failed to add markets");
    }
  }

  /**
   * Subscribes to orderbook_delta for new tickers
   */
  private async resubscribe(): Promise<void> {
    const pending = new Set([...this.seen].filter((ticker) => !this.subscribed.has(ticker)));
    if (pending.size === 0) {
      return;
    }

    for (const ticker of pending) {
      this.subscribed.add(ticker);
    }
    const pendingTickers = Array.from(pending);

    if (this.bookSid === null) {
      this.bookSid = await this.subscribe("orderbook_delta", pendingTickers);
      console.log(`Initialized with ${pendingTickers.length} markets.`);
    } else {
      await this.addMarkets(this.bookSid, pendingTickers);
      console.log(`Added ${pendingTickers.length} markets. ${this.subscribed.size} total.`);
    }
  }

  /**
   * Starts the ingestion process
   */
  async run(): Promise<void> {
    // Set up message handler
    this.ws.on("message", (data: WebSocket.Data) => {
      this.receive(data.toString());
    });

    // Set up error/close handlers
    this.ws.on("error", (error) => {
      throw new Error(`WebSocket error: ${error.message}`);
    });

    this.ws.on("close", () => {
      if (!this.stopRequested) {
        throw new Error("WebSocket closed unexpectedly");
      }
    });

    // Subscribe to trade channel scoped to this instance's seed tickers
    await this.subscribe("trade", Array.from(this.seen));

    // Start concurrent tasks
    this.resubscribeInterval = setInterval(() => {
      this.resubscribe().catch((error) => {
        console.error("Resubscribe error:", error);
        throw error;
      });
    }, 1000);

    this.rateLogInterval = setInterval(() => {
      this.archive.logRate();
    }, 60_000);

    // Wait for stop signal (handled externally via shutdown())
  }

  /**
   * Stops ingestion and cleans up
   */
  async shutdown(): Promise<void> {
    console.log("Shutting down gracefully...");
    this.stopRequested = true;

    // Stop interval tasks
    if (this.resubscribeInterval) {
      clearInterval(this.resubscribeInterval);
    }
    if (this.rateLogInterval) {
      clearInterval(this.rateLogInterval);
    }

    console.log("Disconnecting from WebSocket...");
    this.ws.close();
    console.log("WebSocket disconnected.");

    console.log("Flushing pipelines...");
    await this.archive.flush();
    console.log("Pipelines flushed.");

    console.log("Exiting...");
  }
}
