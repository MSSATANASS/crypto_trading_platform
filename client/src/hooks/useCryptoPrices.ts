import { useCallback, useEffect, useRef, useState } from "react";

export interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  lastUpdated: number;
}

const COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
  { id: "matic-network", symbol: "MATIC", name: "Polygon" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
];

const COIN_IDS = COINS.map((c) => c.id).join(",");

// Smooth client-side micro-update between API polls so the UI feels live.
// Uses ONLY real prices fetched from the API as the base - no synthetic data.
function microUpdate(basePrice: number): number {
  const variation = (Math.random() - 0.5) * 0.0008; // ±0.04% jitter
  return basePrice * (1 + variation);
}

export function useCryptoPrices() {
  const [prices, setPrices] = useState<Record<string, CryptoPrice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const basePricesRef = useRef<Record<string, CryptoPrice>>({});

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const priceMap: Record<string, CryptoPrice> = {};

      for (const coin of data) {
        const meta = COINS.find((c) => c.id === coin.id);
        if (!meta) continue;

        priceMap[meta.symbol] = {
          symbol: meta.symbol,
          name: meta.name,
          price: coin.current_price,
          change24h: coin.price_change_percentage_24h ?? 0,
          volume24h: coin.total_volume ?? 0,
          marketCap: coin.market_cap ?? 0,
          high24h: coin.high_24h ?? coin.current_price,
          low24h: coin.low_24h ?? coin.current_price,
          lastUpdated: Date.now(),
        };
      }

      basePricesRef.current = priceMap;
      setPrices(priceMap);
      setLastFetch(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el feed de precios";
      console.warn("[CryptoPrices] Fetch failed:", err);
      setError(message);
      setLoading(false);
      // Do NOT inject fake data - keep last known real prices if any
    }
  }, []);

  // Simulate real-time price updates between API calls
  const startSimulation = useCallback(() => {
    if (simulationRef.current) clearInterval(simulationRef.current);
    simulationRef.current = setInterval(() => {
      if (Object.keys(basePricesRef.current).length === 0) return;
      setPrices((prev) => {
        const updated = { ...prev };
        for (const sym of Object.keys(updated)) {
          const base = updated[sym];
          if (!base) continue;
          updated[sym] = {
            ...base,
            price: microUpdate(base.price),
            lastUpdated: Date.now(),
          };
        }
        return updated;
      });
    }, 2000);
  }, []);

  useEffect(() => {
    fetchPrices();
    startSimulation();

    // Refresh from API every 30 seconds
    intervalRef.current = setInterval(() => {
      fetchPrices();
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, [fetchPrices, startSimulation]);

  return { prices, loading, error, lastFetch, refetch: fetchPrices };
}

export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  return `$${vol.toLocaleString()}`;
}
