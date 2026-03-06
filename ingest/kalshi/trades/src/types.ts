/**
 * Type definitions for Kalshi trades API
 */

export interface Trade {
  ticker: string;
  trade_id: string;
  side: "yes" | "no";
  yes_price: number;
  no_price: number;
  count: number;
  created_time: string;
  [key: string]: unknown;
}

export interface TradesResponse {
  trades: Trade[];
  cursor?: string;
}
