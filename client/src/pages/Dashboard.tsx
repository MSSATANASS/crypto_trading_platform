import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Wallet,
  BarChart3,
  Activity,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Shield,
} from "lucide-react";
import {
  useCryptoPrices,
  formatPrice,
  formatVolume,
  type CryptoPrice,
} from "@/hooks/useCryptoPrices";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Generate fake chart data for a symbol
function generateChartData(basePrice: number, points = 48) {
  const data = [];
  let price = basePrice * 0.95;
  const now = Date.now();
  for (let i = points; i >= 0; i--) {
    price = price * (1 + (Math.random() - 0.48) * 0.015);
    data.push({
      time: new Date(now - i * 30 * 60 * 1000).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      price: parseFloat(price.toFixed(2)),
    });
  }
  return data;
}

const PAIRS = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "AVAX", "MATIC", "LINK", "DOGE"];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { prices, loading: pricesLoading, lastFetch, error: pricesError, refetch: refetchPrices } = useCryptoPrices();

  const [selectedPair, setSelectedPair] = useState("BTC");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashState, setFlashState] = useState<Record<string, "up" | "down" | null>>({});

  const executeTradeMutation = trpc.trading.executeTrade.useMutation();
  const { data: tradeHistory, refetch: refetchTrades } = trpc.trading.history.useQuery();
  const { data: portfolio, refetch: refetchPortfolio } = trpc.trading.portfolio.useQuery();

  // Auth guard
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  // Generate chart data when pair changes
  useEffect(() => {
    const price = prices[selectedPair]?.price ?? 50000;
    setChartData(generateChartData(price));
  }, [selectedPair]);

  // Update chart with latest price
  useEffect(() => {
    const currentPrice = prices[selectedPair]?.price;
    if (!currentPrice) return;
    setChartData((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last) {
        updated[updated.length - 1] = { ...last, price: parseFloat(currentPrice.toFixed(2)) };
      }
      return updated;
    });
  }, [prices[selectedPair]?.price]);

  // Flash animation on price change
  useEffect(() => {
    const newFlash: Record<string, "up" | "down" | null> = {};
    for (const sym of PAIRS) {
      const current = prices[sym]?.price;
      const prev = prevPricesRef.current[sym];
      if (current && prev) {
        if (current > prev) newFlash[sym] = "up";
        else if (current < prev) newFlash[sym] = "down";
      }
      if (current) prevPricesRef.current[sym] = current;
    }
    if (Object.keys(newFlash).length > 0) {
      setFlashState(newFlash);
      setTimeout(() => setFlashState({}), 600);
    }
  }, [prices]);

  const handleTrade = async () => {
    const amount = parseFloat(tradeAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }
    const price = prices[selectedPair]?.price;
    if (!price) {
      toast.error("Precio no disponible");
      return;
    }

    try {
      const result = await executeTradeMutation.mutateAsync({
        pair: `${selectedPair}-USD`,
        side: tradeSide,
        amount,
        price,
      });
      toast.success(
        `Orden ${tradeSide === "buy" ? "de compra" : "de venta"} ejecutada: ${amount} ${selectedPair} @ $${formatPrice(price)}`
      );
      setTradeAmount("");
      refetchTrades();
      refetchPortfolio();
    } catch (err: unknown) {
      toast.error("Error al ejecutar la orden: " + ((err as Error).message ?? "Inténtalo de nuevo"));
    }
  };

  const selectedCoin = prices[selectedPair];
  const isPositive = (selectedCoin?.change24h ?? 0) >= 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm">NexaTrade</span>
        </div>

        {/* Price ticker */}
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-6 ticker-animate whitespace-nowrap">
            {[...PAIRS, ...PAIRS].map((sym, i) => {
              const coin = prices[sym];
              if (!coin) return null;
              const pos = coin.change24h >= 0;
              return (
                <button
                  key={`${sym}-${i}`}
                  onClick={() => setSelectedPair(sym)}
                  className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
                >
                  <span className="font-semibold text-foreground">{sym}</span>
                  <span className="font-mono text-foreground">${formatPrice(coin.price)}</span>
                  <span className={pos ? "text-gain" : "text-loss"}>
                    {pos ? "+" : ""}{coin.change24h.toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User menu */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.name ?? "Usuario"}</span>
            {user?.role === "admin" && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-gold font-medium">
                Admin
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-xl shadow-xl z-50 py-1">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium">{user?.name ?? "Usuario"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
              </div>
              {user?.role === "admin" && (
                <button
                  onClick={() => { navigate("/admin"); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                >
                  <Shield className="w-4 h-4 text-gold" />
                  Panel de Administración
                </button>
              )}
              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left text-destructive"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Price feed error banner */}
      {pricesError && Object.keys(prices).length === 0 && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-destructive" />
            <span className="text-destructive font-medium">Feed de precios no disponible</span>
            <span className="text-muted-foreground hidden sm:inline">— {pricesError}</span>
          </div>
          <button
            onClick={() => refetchPrices()}
            className="text-xs font-medium px-3 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RefreshCw className="w-3 h-3 inline mr-1" />Reintentar
          </button>
        </div>
      )}
      {pricesError && Object.keys(prices).length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-300 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Mostrando últimos precios válidos. Reconectando al feed en tiempo real…
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Asset list */}
        <aside className="w-56 border-r border-border bg-card/30 flex-shrink-0 overflow-y-auto hidden lg:block">
          <div className="p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Mercados
            </p>
            {PAIRS.map((sym) => {
              const coin = prices[sym];
              const isSelected = sym === selectedPair;
              const pos = (coin?.change24h ?? 0) >= 0;
              const flash = flashState[sym];
              return (
                <button
                  key={sym}
                  onClick={() => setSelectedPair(sym)}
                  className={`w-full flex items-center justify-between px-2 py-2.5 rounded-lg mb-0.5 transition-all duration-150 ${
                    isSelected
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary/50"
                  } ${flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-secondary"
                      }`}
                    >
                      {sym.slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold">{sym}</p>
                      <p className="text-[10px] text-muted-foreground">{coin?.name ?? ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-medium">
                      ${coin ? formatPrice(coin.price) : "—"}
                    </p>
                    <p className={`text-[10px] font-medium ${pos ? "text-gain" : "text-loss"}`}>
                      {coin ? `${pos ? "+" : ""}${coin.change24h.toFixed(2)}%` : "—"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pair header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold font-mono">
                    {selectedPair}/USD
                  </h1>
                  <span
                    className={`flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${
                      isPositive
                        ? "bg-primary/10 text-gain"
                        : "bg-destructive/10 text-loss"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {isPositive ? "+" : ""}
                    {selectedCoin?.change24h.toFixed(2) ?? "0.00"}%
                  </span>
                </div>
                <p className="text-3xl font-bold font-mono mt-1">
                  ${selectedCoin ? formatPrice(selectedCoin.price) : "—"}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className="hidden md:flex items-center gap-6 text-sm">
              {[
                { label: "Máx 24h", value: selectedCoin ? `$${formatPrice(selectedCoin.high24h)}` : "—" },
                { label: "Mín 24h", value: selectedCoin ? `$${formatPrice(selectedCoin.low24h)}` : "—" },
                { label: "Volumen 24h", value: selectedCoin ? formatVolume(selectedCoin.volume24h) : "—" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                  <p className="font-mono font-medium">{s.value}</p>
                </div>
              ))}
              {lastFetch && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  En vivo
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Chart */}
            <div className="xl:col-span-2 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Gráfico de Precio — {selectedPair}/USD</p>
                <span className="text-xs text-muted-foreground">Últimas 24h</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={isPositive ? "oklch(0.65 0.18 145)" : "oklch(0.55 0.22 25)"}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={isPositive ? "oklch(0.65 0.18 145)" : "oklch(0.55 0.22 25)"}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 240)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "oklch(0.55 0.02 240)" }}
                      tickLine={false}
                      axisLine={false}
                      interval={7}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "oklch(0.55 0.02 240)", fontFamily: "JetBrains Mono" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${formatPrice(v)}`}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(0.13 0.015 240)",
                        border: "1px solid oklch(0.22 0.015 240)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`$${formatPrice(value)}`, "Precio"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={isPositive ? "oklch(0.65 0.18 145)" : "oklch(0.55 0.22 25)"}
                      strokeWidth={2}
                      fill="url(#priceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trade panel */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
              <p className="text-sm font-semibold">Nueva Orden</p>

              {/* Buy/Sell toggle */}
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setTradeSide("buy")}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    tradeSide === "buy"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Comprar
                </button>
                <button
                  onClick={() => setTradeSide("sell")}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    tradeSide === "sell"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Vender
                </button>
              </div>

              {/* Pair selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Par</label>
                <select
                  value={selectedPair}
                  onChange={(e) => setSelectedPair(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {PAIRS.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}/USD
                    </option>
                  ))}
                </select>
              </div>

              {/* Price display */}
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Precio de mercado</p>
                <p className="text-lg font-bold font-mono">
                  ${selectedCoin ? formatPrice(selectedCoin.price) : "—"}
                </p>
              </div>

              {/* Amount input */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Cantidad ({selectedPair})
                </label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.0001"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Total */}
              {tradeAmount && selectedCoin && (
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Total estimado (USD)</p>
                  <p className="text-base font-bold font-mono text-primary">
                    ${(parseFloat(tradeAmount) * selectedCoin.price).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-1.5">
                {["25%", "50%", "75%", "100%"].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const base = selectedPair === "BTC" ? 0.1 : selectedPair === "ETH" ? 1 : 10;
                      setTradeAmount((base * parseInt(pct) / 100).toFixed(4));
                    }}
                    className="py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 border border-border transition-colors"
                  >
                    {pct}
                  </button>
                ))}
              </div>

              {/* Execute button */}
              <button
                onClick={handleTrade}
                disabled={executeTradeMutation.isPending || !tradeAmount}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  tradeSide === "buy"
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-destructive text-destructive-foreground hover:opacity-90"
                }`}
              >
                {executeTradeMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </span>
                ) : (
                  `${tradeSide === "buy" ? "Comprar" : "Vender"} ${selectedPair}`
                )}
              </button>
            </div>
          </div>

          {/* Portfolio & Trade History */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Portfolio */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Mi Portafolio</p>
              </div>
              {!portfolio || portfolio.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin posiciones abiertas</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Ejecuta tu primera orden para comenzar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {portfolio.map((h) => {
                    const currentPrice = prices[h.symbol]?.price ?? 0;
                    const value = parseFloat(h.amount) * currentPrice;
                    const avgPrice = parseFloat(h.avgBuyPrice);
                    const pnl = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
                    return (
                      <div
                        key={h.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {h.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{h.symbol}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {parseFloat(h.amount).toFixed(6)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-medium">
                            ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className={`text-xs font-medium ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Trade history */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Historial de Órdenes</p>
              </div>
              {!tradeHistory || tradeHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin órdenes ejecutadas</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tradeHistory.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            t.side === "buy"
                              ? "bg-primary/10 text-gain"
                              : "bg-destructive/10 text-loss"
                          }`}
                        >
                          {t.side === "buy" ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{t.pair}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(t.createdAt).toLocaleString("es-ES", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-medium">
                          {parseFloat(t.amount).toFixed(6)} @ ${formatPrice(parseFloat(t.price))}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ${parseFloat(t.total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
}
