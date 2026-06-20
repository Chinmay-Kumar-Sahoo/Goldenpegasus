"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BackHomeNav from "@/components/BackHomeNav";
import BrandLogo from "@/components/BrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rootMode, setRootMode] = useState(false);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootMessage, setRootMessage] = useState("");

  // Initialize page and check for pre-filled email
  useEffect(() => {
    const initializePage = async () => {
      if (typeof window === "undefined") return;

      let userEmail = "";

      // Store where to redirect after password reset
      const params = new URLSearchParams(window.location.search);
      if (params.get("from") === "admin") {
        localStorage.setItem("reset_redirect", "/admin-login");
      } else {
        localStorage.setItem("reset_redirect", "/login");
      }

      // Try to get logged-in user's email from Supabase
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        userEmail = user.email;
        setEmail(userEmail);
      }

      // Also check localStorage for email from signup
      const storedEmail = localStorage.getItem("signup_email");
      if (storedEmail && !userEmail) {
        setEmail(storedEmail);
      }
    };

    initializePage();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/verify`,
        },
      );

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setMessage(
        `Password reset link sent! Check your email at ${email} for the reset link. The link expires in 24 hours.`,
      );
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#22c55e]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="flex justify-center">
          <BackHomeNav />
        </div>

        <div className="text-center mb-8">
          <BrandLogo href="/" size="md" className="mb-6" />
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-sm text-[#71717a] mt-1">
            {submitted
              ? "Check your email for the reset link"
              : "Enter your email to receive a reset link"}
          </p>
        </div>

        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">
                {message}
              </div>
              <p className="text-sm text-[#a1a1aa]">
                Click the link in your email to reset your password. The link
                expires in 24 hours.
              </p>
              {email && (
                <div className="pt-4">
                  <p className="text-xs text-[#71717a] mb-3">Email sent to:</p>
                  <p className="text-sm font-mono text-[#22c55e] bg-[#1a1a1a] px-4 py-2 rounded-xl break-all">
                    {email}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                  setMessage("");
                }}
                className="w-full mt-6 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-3 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20"
              >
                Send Another Link
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-[#a1a1aa] mb-1.5"
                  htmlFor="email"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 border-t border-[#2a2a2a] pt-6 text-center">
          {/* Root Admin Recovery */}
          {!submitted && (
            <div className="mb-4">
              {!rootMode ? (
                <button
                  onClick={() => setRootMode(true)}
                  className="text-xs text-[#71717a] hover:text-red-400 transition-colors"
                >
                  Root admin? Reset to default credentials
                </button>
              ) : (
                <div className="bg-[#111111] border border-red-500/10 rounded-xl p-4 text-left">
                  <p className="text-xs text-[#a1a1aa] mb-2">
                    This will reset the root admin password to the default credentials configured in the system. Only use this if you cannot access the root admin email.
                  </p>
                  {rootMessage && (
                    <div className={`text-xs mb-2 px-3 py-2 rounded-lg ${rootMessage.includes("success") || rootMessage.includes("Sign in") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                      {rootMessage}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setRootLoading(true);
                      setRootMessage("");
                      try {
                        const res = await fetch("/api/admin/setup", { method: "POST" });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setRootMessage(`✅ ${data.message} Sign in with the default admin credentials.`);
                      } catch (err: any) {
                        setRootMessage(`❌ ${err.message}`);
                      }
                      setRootLoading(false);
                    }}
                    disabled={rootLoading}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    {rootLoading ? "Resetting..." : "Reset Root Admin Password"}
                  </button>
                  <button
                    onClick={() => { setRootMode(false); setRootMessage(""); }}
                    className="mt-2 text-xs text-[#71717a] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-sm text-[#71717a]">
            Remember your password?{" "}
            <Link
              href={(() => {
                if (typeof window !== "undefined") {
                  const from = new URLSearchParams(window.location.search).get("from");
                  return from === "admin" ? "/admin-login" : "/login";
                }
                return "/login";
              })()}
              className="text-[#22c55e] hover:text-[#4ade80] font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
