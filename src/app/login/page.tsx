"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BackHomeNav from "@/components/BackHomeNav";
import BrandLogo from "@/components/BrandLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setTimeout(() => setError(err), 0);
    }
    const msg = params.get("message");
    if (msg) {
      setTimeout(() => setMessage(msg), 0);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Login failed: No user session found.");
        setLoading(false);
        return;
      }

      // Check if email is confirmed
      if (!authData.user.email_confirmed_at) {
        await supabase.auth.signOut({ scope: 'local' });
        setError(
          "Please confirm your email before logging in."
        );
        setMessage("Open the confirmation link sent to your email, then sign in again.");
        setLoading(false);
        return;
      }

      // Get role and redirect
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut({ scope: 'local' });
        setError("Account setup incomplete. Please contact support or try again.");
        setLoading(false);
        return;
      }

      if (profile.role === "admin") {
        await supabase.auth.signOut({ scope: 'local' });
        setError("Administrators must use the Admin Login portal.");
        setLoading(false);
      } else {
        // Use window.location for a hard redirect to ensure session is fresh
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#22c55e]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="flex justify-center">
          <BackHomeNav hideBack={true} />
        </div>

        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <BrandLogo size="lg" className="mb-6" subtitle="IT Consulting & Services LLC" />
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-[#71717a] mt-1">Sign in to your account</p>
        </div>

        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-[#a1a1aa] mb-1.5"
                htmlFor="login-email"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                suppressHydrationWarning={true}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="block text-sm font-medium text-[#a1a1aa]"
                  htmlFor="login-password"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  suppressHydrationWarning={true}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors p-1"
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-[#22c55e] hover:text-[#4ade80] font-medium transition-colors"
              >
                Forgot your password?
              </Link>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                {error.includes("Admin Login portal") ? (
                  <span>
                    Administrators must use the{" "}
                    <Link
                      href="/admin-login"
                      className="underline font-bold hover:text-red-300"
                    >
                      Admin Login portal
                    </Link>
                    .
                  </span>
                ) : (
                  error
                )}
              </div>
            )}

            {message && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#71717a] mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-[#22c55e] hover:text-[#4ade80] font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
