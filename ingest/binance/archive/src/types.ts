/**
 * Type definitions for Binance archive service
 */

export interface Config {
  ingestDir: string;
  concurrency: number;
  startDate: Date;
  endDate: Date;
}

export type Symbol = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";

export const SYMBOL_STARTS: Record<Symbol, Date> = {
  BTCUSDT: new Date("2017-08-01"),
  ETHUSDT: new Date("2017-08-01"),
  SOLUSDT: new Date("2020-08-01"),
};
