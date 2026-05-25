import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Shield, TrendingUp, Zap, Lock } from "lucide-react";

declare global {
  interface Window {
    Stytch?: {
      initialize: (token: string) => {
        oauth: {
          coinbase: {
            start: (opts: { login_redirect_url: string; signup_redirect_url: string }) => void;
          };
        };
      };
    };
  }
}

const STYTCH_PUBLIC_TOKEN = import.meta.env.VITE_STYTCH_PUBLIC_TOKEN as string;

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [authLoading, setAuthLoading] = useState(false);
  const stytchCallbackMutation = trpc.auth.stytchCallback.useMutation();
  const stytchRef = useRef<ReturnType<NonNullable<typeof window.Stytch>["initialize"]> | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  // Handle Stytch OAuth callback token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const tokenType = params.get("stytch_token_type");

    if (token && tokenType === "oauth") {
      setAuthLoading(true);
      stytchCallbackMutation
        .mutateAsync({
          token,
          tokenType: "oauth",
          origin: window.location.origin,
        })
        .then((result) => {
          if (result.success) {
            // Store JWT in localStorage for API calls
            localStorage.setItem("auth_jwt", result.jwt);
            toast.success(
              result.isNewUser
                ? `Bienvenido, ${result.user.name ?? "usuario"}. Cuenta creada exitosamente.`
                : `Sesión iniciada. Bienvenido de vuelta, ${result.user.name ?? "usuario"}.`
            );
            // Force page reload to pick up new session cookie
            window.location.href = "/dashboard";
          }
        })
        .catch((err) => {
          toast.error("Error de autenticación: " + (err.message ?? "Inténtalo de nuevo."));
          setAuthLoading(false);
          // Clean URL
          window.history.replaceState({}, "", "/login");
        });
    }
  }, []);

  const handleCoinbaseLogin = () => {
    if (!STYTCH_PUBLIC_TOKEN) {
      toast.error("Configuración de autenticación no disponible.");
      return;
    }

    const redirectUrl = `${window.location.origin}/login`;

    // Use Stytch SDK via CDN script
    const stytch = (window as unknown as Record<string, unknown>)["stytch"] as
      | {
          oauth: {
            coinbase: {
              start: (opts: { login_redirect_url: string; signup_redirect_url: string }) => void;
            };
          };
        }
      | undefined;

    if (stytch?.oauth?.coinbase) {
      stytch.oauth.coinbase.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } else {
      // Fallback: direct Stytch OAuth URL
      const stytchOAuthUrl = `https://api.stytch.com/v1/public/oauth/coinbase/start?public_token=${STYTCH_PUBLIC_TOKEN}&login_redirect_url=${encodeURIComponent(redirectUrl)}&signup_redirect_url=${encodeURIComponent(redirectUrl)}`;
      window.location.href = stytchOAuthUrl;
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            {authLoading ? "Verificando credenciales..." : "Cargando..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, oklch(0.65 0.18 145 / 0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, oklch(0.75 0.15 75 / 0.06) 0%, transparent 50%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.95 0.01 240) 1px, transparent 1px), linear-gradient(90deg, oklch(0.95 0.01 240) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <span className="text-xl font-bold text-foreground">NexaTrade</span>
              <span className="block text-xs text-muted-foreground tracking-widest uppercase">
                Digital Assets
              </span>
            </div>
          </div>

          {/* Main headline */}
          <div className="space-y-6">
            <h1 className="text-5xl font-bold leading-tight">
              <span className="text-foreground">Accede a los</span>
              <br />
              <span className="text-primary">mercados globales</span>
              <br />
              <span className="text-foreground">de activos digitales</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
              Plataforma institucional de trading de criptomonedas con liquidez profunda,
              ejecución en tiempo real y seguridad de nivel bancario.
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 space-y-4">
          {[
            {
              icon: <Zap className="w-4 h-4" />,
              title: "Ejecución instantánea",
              desc: "Latencia sub-milisegundo en todas las operaciones",
            },
            {
              icon: <Shield className="w-4 h-4" />,
              title: "Seguridad institucional",
              desc: "Autenticación OAuth 2.0 con Coinbase",
            },
            {
              icon: <Lock className="w-4 h-4" />,
              title: "Custodia segura",
              desc: "Tokens cifrados con estándares bancarios",
            },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-8 border-t border-border">
          {[
            { value: "$2.4B+", label: "Volumen diario" },
            { value: "180+", label: "Activos digitales" },
            { value: "99.99%", label: "Uptime garantizado" },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-xl font-bold text-primary font-mono">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">NexaTrade</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Iniciar sesión</h2>
            <p className="text-muted-foreground">
              Accede a tu cuenta con tu identidad de Coinbase
            </p>
          </div>

          {/* Login card */}
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            {/* Coinbase OAuth button */}
            <button
              onClick={handleCoinbaseLogin}
              className="w-full flex items-center justify-center gap-3 h-14 rounded-xl font-semibold text-base transition-all duration-200 relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, oklch(0.16 0.015 240), oklch(0.20 0.015 240))",
                border: "1px solid oklch(0.28 0.015 240)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "oklch(0.65 0.18 145 / 0.5)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 20px oklch(0.65 0.18 145 / 0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "oklch(0.28 0.015 240)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              {/* Coinbase logo SVG */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="12" fill="#0052FF" />
                <path
                  d="M12 6C8.686 6 6 8.686 6 12C6 15.314 8.686 18 12 18C14.97 18 17.44 16.005 18.174 13.273H15.273C14.693 14.553 13.448 15.455 12 15.455C9.556 15.455 7.545 13.444 7.545 11C7.545 8.556 9.556 6.545 12 6.545C13.448 6.545 14.693 7.447 15.273 8.727H18.174C17.44 5.995 14.97 4 12 4V6Z"
                  fill="white"
                />
              </svg>
              <span className="text-foreground">Continuar con Coinbase</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-card text-xs text-muted-foreground">
                  Autenticación segura via OAuth 2.0
                </span>
              </div>
            </div>

            {/* Security badges */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "🔐", text: "Cifrado AES-256" },
                { icon: "🛡️", text: "OAuth 2.0 PKCE" },
                { icon: "🔒", text: "Tokens seguros" },
                { icon: "✅", text: "KYC verificado" },
              ].map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border"
                >
                  <span className="text-sm">{b.icon}</span>
                  <span className="text-xs text-muted-foreground">{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
            Al acceder, aceptas nuestros{" "}
            <span className="text-primary cursor-pointer hover:underline">
              Términos de Servicio
            </span>{" "}
            y{" "}
            <span className="text-primary cursor-pointer hover:underline">
              Política de Privacidad
            </span>
            . NexaTrade opera bajo regulaciones de activos digitales.
          </p>
        </div>
      </div>
    </div>
  );
}
