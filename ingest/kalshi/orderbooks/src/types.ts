/**
 * Type definitions for Kalshi WebSocket API
 */

export interface WsCommand {
  id: number;
  cmd: string;
  params: Record<string, unknown>;
}

export interface WsResponse {
  id?: number;
  type: string;
  msg?: Record<string, unknown>;
  sid?: number;
}

export interface TradeMessage {
  type: "trade";
  msg: {
    market_ticker: string;
    [key: string]: unknown;
  };
}

export interface OrderbookMessage {
  type: "orderbook_snapshot" | "orderbook_delta";
  msg: {
    market_ticker: string;
    [key: string]: unknown;
  };
}
