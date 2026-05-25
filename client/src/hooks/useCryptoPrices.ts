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

// Simulated price variation for real-time feel
function simulatePriceVariation(basePrice: number): number {
  const variation = (Math.random() - 0.5) * 0.002; // ±0.1% variation
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
      console.warn("[CryptoPrices] Fetch failed, using simulated data:", err);
      setError("Usando datos simulados");

      // Fallback simulated data
      if (Object.keys(basePricesRef.current).length === 0) {
        const simulated: Record<string, CryptoPrice> = {
          BTC: { symbol: "BTC", name: "Bitcoin", price: 67842.50, change24h: 2.34, volume24h: 28_400_000_000, marketCap: 1_330_000_000_000, high24h: 68_500, low24h: 66_200, lastUpdated: Date.now() },
          ETH: { symbol: "ETH", name: "Ethereum", price: 3521.80, change24h: 1.87, volume24h: 14_200_000_000, marketCap: 423_000_000_000, high24h: 3_600, low24h: 3_420, lastUpdated: Date.now() },
          SOL: { symbol: "SOL", name: "Solana", price: 182.45, change24h: 4.21, volume24h: 3_800_000_000, marketCap: 84_000_000_000, high24h: 188, low24h: 175, lastUpdated: Date.now() },
          BNB: { symbol: "BNB", name: "BNB", price: 598.30, change24h: -0.45, volume24h: 1_900_000_000, marketCap: 87_000_000_000, high24h: 610, low24h: 592, lastUpdated: Date.now() },
          ADA: { symbol: "ADA", name: "Cardano", price: 0.6234, change24h: 3.12, volume24h: 620_000_000, marketCap: 22_000_000_000, high24h: 0.64, low24h: 0.60, lastUpdated: Date.now() },
          XRP: { symbol: "XRP", name: "XRP", price: 0.5821, change24h: -1.23, volume24h: 1_100_000_000, marketCap: 32_000_000_000, high24h: 0.60, low24h: 0.57, lastUpdated: Date.now() },
          AVAX: { symbol: "AVAX", name: "Avalanche", price: 38.72, change24h: 5.67, volume24h: 480_000_000, marketCap: 16_000_000_000, high24h: 40, low24h: 36.5, lastUpdated: Date.now() },
          MATIC: { symbol: "MATIC", name: "Polygon", price: 0.8934, change24h: 2.89, volume24h: 380_000_000, marketCap: 8_900_000_000, high24h: 0.92, low24h: 0.87, lastUpdated: Date.now() },
          LINK: { symbol: "LINK", name: "Chainlink", price: 14.82, change24h: 1.45, volume24h: 420_000_000, marketCap: 9_200_000_000, high24h: 15.2, low24h: 14.5, lastUpdated: Date.now() },
          DOGE: { symbol: "DOGE", name: "Dogecoin", price: 0.1623, change24h: -0.87, volume24h: 890_000_000, marketCap: 23_000_000_000, high24h: 0.168, low24h: 0.158, lastUpdated: Date.now() },
        };
        basePricesRef.current = simulated;
        setPrices(simulated);
        setLoading(false);
      }
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
            price: simulatePriceVariation(base.price),
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
