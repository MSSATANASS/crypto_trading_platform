import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Users,
  Activity,
  BarChart3,
  Shield,
  ChevronRight,
  TrendingUp,
  Key,
  Clock,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-card border rounded-xl p-4 card-hover ${
        accent ? "border-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            accent ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold font-mono">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-primary mt-1">{sub}</p>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-secondary transition-colors"
      title="Copiar"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-gain" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function TokenDisplay({ token, label }: { token: string | null | undefined; label: string }) {
  const [visible, setVisible] = useState(false);
  if (!token) return <span className="text-muted-foreground text-xs italic">No disponible</span>;

  return (
    <div className="flex items-center gap-1.5">
      <code className="text-xs font-mono bg-secondary/80 px-2 py-1 rounded max-w-xs truncate block">
        {visible ? token : `${token.substring(0, 16)}${"•".repeat(12)}${token.slice(-6)}`}
      </code>
      <button
        onClick={() => setVisible(!visible)}
        className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0"
        title={visible ? "Ocultar" : "Mostrar"}
      >
        {visible ? (
          <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      <CopyButton text={token} />
    </div>
  );
}

export default function Admin() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "logs" | "trades">("overview");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.listUsers.useQuery();
  const { data: allLogs, isLoading: logsLoading } = trpc.admin.allLogs.useQuery();
  const { data: allTrades, isLoading: tradesLoading } = trpc.admin.allTrades.useQuery();
  const { data: userDetail, isLoading: detailLoading } = trpc.admin.getUserDetail.useQuery(
    { userId: selectedUserId! },
    { enabled: selectedUserId !== null }
  );

  // Auth guard - admin only
  if (!loading && (!isAuthenticated || user?.role !== "admin")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Acceso Restringido</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Esta sección está reservada exclusivamente para administradores de la plataforma.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Resumen", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "users", label: "Clientes", icon: <Users className="w-4 h-4" /> },
    { id: "logs", label: "Logs de Actividad", icon: <Activity className="w-4 h-4" /> },
    { id: "trades", label: "Operaciones", icon: <TrendingUp className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card/50 sticky top-0 z-50 flex items-center px-4 gap-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-gold" />
          </div>
          <span className="font-bold text-sm">Panel de Administración</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-gold border border-accent/20 font-medium">
            Admin
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {user?.name ?? user?.email}
          </span>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-card/30 flex-shrink-0 p-3 hidden md:block">
          <div className="space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedUserId(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Mobile tabs */}
          <div className="flex gap-1 mb-4 md:hidden overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedUserId(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Resumen de la Plataforma</h2>
                <p className="text-sm text-muted-foreground">
                  Métricas en tiempo real de todos los usuarios y operaciones
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Usuarios registrados"
                  value={stats?.totalUsers ?? "—"}
                  sub={`+${stats?.newUsersToday ?? 0} hoy`}
                  icon={<Users className="w-4 h-4" />}
                  accent
                />
                <StatCard
                  label="Operaciones totales"
                  value={stats?.totalTrades ?? "—"}
                  sub={`${stats?.tradesLast24h ?? 0} últimas 24h`}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <StatCard
                  label="Volumen total (USD)"
                  value={stats?.totalVolume ? `$${parseFloat(stats.totalVolume).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                  icon={<BarChart3 className="w-4 h-4" />}
                />
                <StatCard
                  label="Eventos registrados"
                  value={stats?.totalLogs ?? "—"}
                  icon={<Activity className="w-4 h-4" />}
                />
              </div>

              {/* Recent users */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold">Usuarios Recientes</p>
                  <button
                    onClick={() => setActiveTab("users")}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Ver todos <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {(users ?? []).slice(0, 5).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(u.name ?? u.email ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name ?? "Sin nombre"}</p>
                          <p className="text-xs text-muted-foreground">{u.email ?? "Sin email"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            u.role === "admin"
                              ? "bg-accent/10 text-gold"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {u.role}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(u.createdAt).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {activeTab === "users" && !selectedUserId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Clientes Registrados</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {users?.length ?? 0} usuarios en la plataforma
                  </p>
                </div>
                <button
                  onClick={() => refetchUsers()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuario</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rol</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coinbase Token</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Último acceso</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registro</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(users ?? []).map((u, i) => (
                          <tr
                            key={u.id}
                            className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${
                              i % 2 === 0 ? "" : "bg-secondary/10"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                  {(u.name ?? u.email ?? "?")[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">{u.name ?? "Sin nombre"}</p>
                                  <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  u.role === "admin"
                                    ? "bg-accent/10 text-gold border border-accent/20"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <TokenDisplay token={u.coinbaseAccessToken} label="Coinbase Token" />
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                              {new Date(u.lastSignedIn).toLocaleString("es-ES")}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                              {new Date(u.createdAt).toLocaleString("es-ES")}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedUserId(u.id)}
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                Detalle <ChevronRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── User Detail ── */}
          {activeTab === "users" && selectedUserId && (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedUserId(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a la lista
              </button>

              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userDetail ? (
                <div className="space-y-4">
                  {/* User profile card */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
                        {(userDetail.user.name ?? userDetail.user.email ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold">{userDetail.user.name ?? "Sin nombre"}</h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              userDetail.user.role === "admin"
                                ? "bg-accent/10 text-gold border border-accent/20"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {userDetail.user.role}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{userDetail.user.email ?? "Sin email"}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Registrado: {new Date(userDetail.user.createdAt).toLocaleString("es-ES")}
                        </p>
                      </div>
                    </div>

                    {/* Token section */}
                    <div className="mt-5 pt-5 border-t border-border space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" />
                        Credenciales OAuth
                      </p>
                      <div className="grid gap-3">
                        {[
                          { label: "Coinbase Access Token", value: userDetail.user.coinbaseAccessToken },
                          { label: "Coinbase Refresh Token", value: userDetail.user.coinbaseRefreshToken },
                          { label: "JWT de Plataforma", value: userDetail.user.lastJwt },
                          { label: "Stytch Session Token", value: userDetail.user.stytchSessionToken },
                        ].map((item) => (
                          <div key={item.label} className="bg-secondary/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1.5">{item.label}</p>
                            <TokenDisplay token={item.value} label={item.label} />
                          </div>
                        ))}
                        {userDetail.user.coinbaseTokenExpiresAt && (
                          <div className="bg-secondary/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Expiración del token</p>
                            <p className="text-xs font-mono">
                              {new Date(userDetail.user.coinbaseTokenExpiresAt).toLocaleString("es-ES")}
                            </p>
                          </div>
                        )}
                        {userDetail.user.coinbaseScopes && (
                          <div className="bg-secondary/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Scopes OAuth</p>
                            <p className="text-xs font-mono text-primary">{userDetail.user.coinbaseScopes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Activity logs */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Log de Actividad ({userDetail.logs.length} eventos)
                    </p>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {userDetail.logs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin eventos registrados</p>
                      ) : (
                        userDetail.logs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 rounded-lg bg-secondary/50 border border-border"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      log.eventType === "login" || log.eventType === "register"
                                        ? "bg-primary/10 text-primary"
                                        : log.eventType === "trade"
                                        ? "bg-accent/10 text-gold"
                                        : "bg-secondary text-muted-foreground"
                                    }`}
                                  >
                                    {log.eventType}
                                  </span>
                                  <span className="text-xs text-foreground">{log.description}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  {log.ipAddress && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      IP: {log.ipAddress}
                                    </span>
                                  )}
                                  {log.jwtSnapshot && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">JWT:</span>
                                      <code className="text-[10px] font-mono text-muted-foreground">
                                        {log.jwtSnapshot.substring(0, 20)}...
                                      </code>
                                      <CopyButton text={log.jwtSnapshot} />
                                    </div>
                                  )}
                                  {log.coinbaseTokenSnapshot && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">CB Token:</span>
                                      <code className="text-[10px] font-mono text-muted-foreground">
                                        {log.coinbaseTokenSnapshot.substring(0, 16)}...
                                      </code>
                                      <CopyButton text={log.coinbaseTokenSnapshot} />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap flex-shrink-0">
                                {new Date(log.createdAt).toLocaleString("es-ES")}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Trades */}
                  {userDetail.trades.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Operaciones ({userDetail.trades.length})
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left pb-2 text-muted-foreground font-medium">Par</th>
                              <th className="text-left pb-2 text-muted-foreground font-medium">Lado</th>
                              <th className="text-right pb-2 text-muted-foreground font-medium">Cantidad</th>
                              <th className="text-right pb-2 text-muted-foreground font-medium">Precio</th>
                              <th className="text-right pb-2 text-muted-foreground font-medium">Total</th>
                              <th className="text-right pb-2 text-muted-foreground font-medium">Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetail.trades.map((t) => (
                              <tr key={t.id} className="border-b border-border/30">
                                <td className="py-2 font-semibold">{t.pair}</td>
                                <td className="py-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-medium ${
                                      t.side === "buy"
                                        ? "bg-primary/10 text-gain"
                                        : "bg-destructive/10 text-loss"
                                    }`}
                                  >
                                    {t.side === "buy" ? "COMPRA" : "VENTA"}
                                  </span>
                                </td>
                                <td className="py-2 text-right font-mono">{parseFloat(t.amount).toFixed(6)}</td>
                                <td className="py-2 text-right font-mono">${parseFloat(t.price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                <td className="py-2 text-right font-mono font-semibold">${parseFloat(t.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                <td className="py-2 text-right text-muted-foreground">
                                  {new Date(t.createdAt).toLocaleString("es-ES")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* ── All Logs ── */}
          {activeTab === "logs" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Log Global de Actividad</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Todos los eventos de la plataforma ({allLogs?.length ?? 0} registros)
                </p>
              </div>
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Usuario ID</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Evento</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Descripción</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider">IP</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider">JWT</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider">CB Token</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(allLogs ?? []).map((log, i) => (
                          <tr
                            key={log.id}
                            className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${
                              i % 2 === 0 ? "" : "bg-secondary/10"
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono">
                              <button
                                onClick={() => { setSelectedUserId(log.userId); setActiveTab("users"); }}
                                className="text-primary hover:underline"
                              >
                                #{log.userId}
                              </button>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded font-medium ${
                                  log.eventType === "login" || log.eventType === "register"
                                    ? "bg-primary/10 text-primary"
                                    : log.eventType === "trade"
                                    ? "bg-accent/10 text-gold"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                {log.eventType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 max-w-xs truncate text-muted-foreground">
                              {log.description}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-muted-foreground">
                              {log.ipAddress ?? "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              {log.jwtSnapshot ? (
                                <div className="flex items-center gap-1">
                                  <code className="font-mono text-muted-foreground">
                                    {log.jwtSnapshot.substring(0, 12)}...
                                  </code>
                                  <CopyButton text={log.jwtSnapshot} />
                                </div>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              {log.coinbaseTokenSnapshot ? (
                                <div className="flex items-center gap-1">
                                  <code className="font-mono text-muted-foreground">
                                    {log.coinbaseTokenSnapshot.substring(0, 10)}...
                                  </code>
                                  <CopyButton text={log.coinbaseTokenSnapshot} />
                                </div>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("es-ES")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── All Trades ── */}
          {activeTab === "trades" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Todas las Operaciones</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {allTrades?.length ?? 0} operaciones en la plataforma
                </p>
              </div>
              {tradesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuario ID</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Par</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lado</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cantidad</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precio</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total USD</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(allTrades ?? []).map((t, i) => (
                          <tr
                            key={t.id}
                            className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${
                              i % 2 === 0 ? "" : "bg-secondary/10"
                            }`}
                          >
                            <td className="px-4 py-3 font-mono text-sm">
                              <button
                                onClick={() => { setSelectedUserId(t.userId); setActiveTab("users"); }}
                                className="text-primary hover:underline"
                              >
                                #{t.userId}
                              </button>
                            </td>
                            <td className="px-4 py-3 font-semibold">{t.pair}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  t.side === "buy"
                                    ? "bg-primary/10 text-gain"
                                    : "bg-destructive/10 text-loss"
                                }`}
                              >
                                {t.side === "buy" ? "COMPRA" : "VENTA"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{parseFloat(t.amount).toFixed(6)}</td>
                            <td className="px-4 py-3 text-right font-mono">${parseFloat(t.price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold">${parseFloat(t.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {t.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleString("es-ES")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
