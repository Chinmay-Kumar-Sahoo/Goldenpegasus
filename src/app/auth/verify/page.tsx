"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

// Module-level variable to prevent React Strict Mode from firing the verification twice
let isVerifying = false;

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Verifying...");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isVerifying) return;
    isVerifying = true;

    const code = searchParams.get("code");
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as any;
    const next = searchParams.get("next") ?? "/dashboard";

    const verify = async () => {
      const supabase = createClient();
      let authError = null;
      let activeUser = null;

      // Priority 1: Handle token_hash (from email with PKCE)
      if (token_hash && type) {
        setStatus(
          `Verifying ${type === "recovery" ? "password reset" : "email"}...`,
        );
        const { error, data } = await supabase.auth.verifyOtp({
          token_hash,
          type,
        });
        authError = error;
        activeUser = data?.user;

        // If token_hash verification fails, try code exchange as fallback
        if (authError && code) {
          const { error: codeError, data: codeData } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!codeError) {
            authError = null;
            activeUser = codeData?.user;
          }
        }
      }
      // Priority 2: Handle code exchange (PKCE flow)
      else if (code) {
        setStatus("Exchanging authentication code...");
        const { error, data } =
          await supabase.auth.exchangeCodeForSession(code);
        authError = error;
        activeUser = data?.user;
      }
      // Priority 3: Check for errors in URL
      else {
        const authErr =
          searchParams.get("error_description") || searchParams.get("error");
        if (authErr) {
          authError = new Error(authErr);
        } else {
          // No tokens found, check if already logged in
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            activeUser = user;
          } else {
            authError = new Error("No verification token found in URL.");
          }
        }
      }

      // Double-check if user is logged in even with error (handles token reuse)
      if (authError && !activeUser) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          activeUser = user;
          authError = null;
        }
      }

      if (authError && !activeUser) {
        setStatus("Verification failed");

        let detailedError = authError.message;

        // Provide helpful error messages based on failure type
        if (searchParams.get("error_description")) {
          detailedError = `Token Error: ${authError.message}. This may mean the link was used twice or the token expired (valid for 24 hours).`;
        } else if (code && authError) {
          detailedError = `PKCE Exchange Failed: ${authError.message}. If you opened this link in a different browser or incognito mode, please try again in the same browser.`;
        }

        setErrorMsg(detailedError);
      } else if (activeUser) {
        // Check if this is a recovery flow
        if (type === "recovery") {
          setStatus("Password recovery verified. Redirecting...");
          // Store a flag that password can be reset
          localStorage.setItem("recovery_verified", "true");
          setTimeout(() => {
            router.push("/reset-password");
          }, 1000);
          return;
        }

        setStatus("Verification successful! Redirecting...");

        // Check user role and redirect accordingly
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", activeUser.id)
            .single();
          if (profile?.role === "admin") {
            router.push("/admin");
            return;
          }
        } catch (e) {
          // Profile might not exist yet, proceed anyway
        }

        setTimeout(() => {
          router.push(next);
        }, 1000);
      }
    };

    verify();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#22c55e]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 text-center relative z-10">
        <div className="flex justify-center mb-6">
          <BrandLogo variant="mark" size="lg" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">{status}</h2>

        {errorMsg && (
          <div className="mt-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 mb-6 text-left">
              {errorMsg}
            </div>
            <Link
              href="/login"
              className="inline-block w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white font-medium py-3 rounded-xl transition-colors"
            >
              Return to Login
            </Link>
          </div>
        )}

        {!errorMsg && (
          <div className="mt-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#22c55e]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="w-full max-w-md bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 text-center relative z-10">
            <div className="flex justify-center mb-6">
              <BrandLogo variant="mark" size="lg" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Verifying your email...
            </h2>
            <div className="mt-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
