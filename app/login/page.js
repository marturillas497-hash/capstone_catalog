"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Eye, EyeOff, ScanLine, Lightbulb, BookOpen } from "lucide-react";

const STATUS_MESSAGES = {
  pending:
    "Your adviser account is pending admin approval. You will receive an email once reviewed.",
  rejected:
    "Your account application was not approved. Please contact the administrator.",
  suspended:
    "Your account has been suspended. Please contact the administrator.",
  registered:
    "Account created successfully. You can now log in.",
};

const FEATURES = [
  { icon: ScanLine, label: "Semantic Similarity Detection" },
  { icon: Lightbulb, label: "AI Advisory by Claude" },
  { icon: BookOpen, label: "BSIS Abstract Catalog" },
];

// Background photo lives at /public/bg_login.jpg. Tint overlay keeps the
// white text/logos legible regardless of how bright the source photo is;
// adjust the bg-navy/55 opacity below once you see it live.
function PanelBackdrop() {
  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/bg_login.jpg')" }}
      />
      <div className="absolute inset-0 bg-navy/55 pointer-events-none" />
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inlineStatus, setInlineStatus] = useState(null);

  const statusKey = searchParams.get("status") || searchParams.get("error");
  const statusMessage = statusKey ? STATUS_MESSAGES[statusKey] : null;
  const isInfo = statusKey === "pending" || statusKey === "registered";

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (!profile) {
      setError("Account setup incomplete. Please contact the administrator.");
      setLoading(false);
      return;
    }

    if (profile.role === "capstone_adviser" && profile.status === "pending") {
      await supabase.auth.signOut();
      setInlineStatus({ message: STATUS_MESSAGES.pending, isInfo: true });
      setLoading(false);
      return;
    }

    if (profile.status === "rejected" || profile.status === "suspended") {
      await supabase.auth.signOut();
      setInlineStatus({ message: STATUS_MESSAGES[profile.status], isInfo: false });
      setLoading(false);
      return;
    }

    const homeMap = {
      admin: "/admin",
      capstone_adviser: "/adviser",
      student: "/dashboard",
    };

    router.push(homeMap[profile.role] ?? "/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 lg:py-6 lg:px-10">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-neo overflow-hidden flex flex-col lg:flex-row">

        {/* Mobile-only top banner */}
        <div className="lg:hidden bg-navy px-6 pt-8 pb-6 relative overflow-hidden">
          <PanelBackdrop />
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-orange z-10" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/mist-logo.png"
                alt="MIST"
                className="h-10 w-10 object-contain"
              />
              <div className="w-px h-8 bg-white/15" />
              <img
                src="/is-logo.png"
                alt="Information Systems"
                className="h-10 w-10 object-contain"
              />
            </div>
            <p className="text-white text-sm font-medium leading-snug">
              Makilala Institute of Science and Technology
            </p>
            <p className="text-orange text-xs leading-snug mt-0.5">
              Bachelor of Science in Information Systems
            </p>
          </div>
        </div>

        {/* Left panel */}
        <div className="hidden lg:flex lg:w-[45%] flex-col justify-center p-10 relative overflow-hidden bg-navy">
          <PanelBackdrop />

          {/* IS Orange accent strip */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-orange z-10" />

          {/* Content group: crest, feature list, description, sit together and center as one unit */}
          <div className="relative z-10 flex flex-col gap-10">

            {/* Crest lockup */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                <img
                  src="/mist-logo.png"
                  alt="MIST"
                  className="h-20 w-20 object-contain"
                />
                <div className="w-px h-12 bg-white/15" />
                <img
                  src="/is-logo.png"
                  alt="Information Systems"
                  className="h-20 w-20 object-contain"
                />
              </div>
              <p className="text-white/80 text-sm font-medium leading-snug">
                Makilala Institute of Science and Technology
              </p>
              <p className="text-orange text-xs leading-snug mt-0.5">
                Bachelor of Science in Information Systems
              </p>
            </div>

            {/* Feature pills */}
            <div className="space-y-3">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 bg-white/10 border border-white/10 rounded-xl px-4 py-3"
                >
                  <f.icon className="text-white shrink-0 w-4 h-4" strokeWidth={1.75} />
                  <span className="text-white text-sm font-medium">{f.label}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto text-center">
              Validate your proposed capstone topics against the BSIS institutional
              library through semantic similarity detection and AI-powered advisory
              feedback.
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white">
          <div className="w-full max-w-sm animate-page-ease-in">

            <h1 className="font-display !font-bold text-navy leading-tight mb-1">
              <span className="block text-3xl">MIST - BSIS</span>
              <span className="block text-3xl">Capstone Library</span>
            </h1>
            <p className="text-sm text-slate-600 mb-8">
              Sign in to your Capstone Library Account
            </p>

            {(inlineStatus || statusMessage) && (
              <div
                className={`mb-6 px-4 py-3 rounded-lg text-sm ${
                  (inlineStatus?.isInfo ?? isInfo)
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {inlineStatus?.message ?? statusMessage}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Email"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 transition neo-transition"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  className="w-full pl-11 pr-11 py-3 rounded-2xl bg-background shadow-neo-inset border-none text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 transition neo-transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-navy text-white text-sm font-medium py-3 rounded-full hover:bg-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Logging in…" : "Log In"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              No account yet?{" "}
              <a href="/register" className="text-orange font-medium hover:underline">
                Register here
              </a>
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}