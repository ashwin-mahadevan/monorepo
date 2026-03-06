/**
 * URL builders for Binance Vision data API
 */

const BASE_URL = "https://data.binance.vision/data/spot";

export function klineUrl(symbol: string, year: number, month: number, day?: number): string {
  if (day === undefined) {
    const filename = `${symbol}-1s-${year}-${month.toString().padStart(2, "0")}.zip`;
    return `${BASE_URL}/monthly/klines/${symbol}/1s/${filename}`;
  }

  const filename = `${symbol}-1s-${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}.zip`;
  return `${BASE_URL}/daily/klines/${symbol}/1s/${filename}`;
}

export function tradeUrl(symbol: string, year: number, month: number, day?: number): string {
  if (day === undefined) {
    const filename = `${symbol}-aggTrades-${year}-${month.toString().padStart(2, "0")}.zip`;
    return `${BASE_URL}/monthly/aggTrades/${symbol}/${filename}`;
  }

  const filename = `${symbol}-aggTrades-${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}.zip`;
  return `${BASE_URL}/daily/aggTrades/${symbol}/${filename}`;
}
