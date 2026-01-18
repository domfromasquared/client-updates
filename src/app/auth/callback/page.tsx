"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function getHashParams() {
  const hash = window.location.hash?.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash || "";
  return new URLSearchParams(hash);
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      console.log("Callback hit:", window.location.href);

      // 1) If we already have a session, go straight to /status
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        router.replace("/status");
        return;
      }

      // 2) PKCE code flow: /auth/callback?code=...
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        console.log("Exchange error:", error?.message ?? "none");

        if (error) {
          router.replace("/login");
          return;
        }

        router.replace("/status");
        return;
      }

      // 3) Hash token flow: /auth/callback#access_token=...&refresh_token=...
      const hashParams = getHashParams();
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        console.log("Set session error:", error?.message ?? "none");

        if (error) {
          router.replace("/login");
          return;
        }

        router.replace("/status");
        return;
      }

      // 4) Nothing usable in the URL
      console.log("No code or tokens found in callback URL");
      router.replace("/login");
    })();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
        Signing you in…
      </div>
    </main>
  );
}
