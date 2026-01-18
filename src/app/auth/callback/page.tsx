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
    let cancelled = false;

    (async () => {
      try {
        // Helpful for diagnosing production-only issues
        console.log("Callback hit:", window.location.href);

        // 1) If we already have a session, go straight to /status
        const existing = await supabase.auth.getSession();
        if (existing.data.session) {
          if (!cancelled) router.replace("/status");
          return;
        }

        // 2) PKCE code flow: /auth/callback?code=...
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          console.log("Exchange error:", error?.message ?? "none");

          if (error) {
            if (!cancelled) router.replace("/login");
            return;
          }
        } else {
          // 3) Hash token flow: /auth/callback#access_token=...&refresh_token=...
          const hashParams = getHashParams();
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            console.log("Set session error:", error?.message ?? "none");

            if (error) {
              if (!cancelled) router.replace("/login");
              return;
            }
          } else {
            // 4) Nothing usable in the URL
            console.log("No code or tokens found in callback URL");
            if (!cancelled) router.replace("/login");
            return;
          }
        }

        // IMPORTANT: wait for the session to actually be persisted before redirecting
        for (let i = 0; i < 12; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (!cancelled) router.replace("/status");
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        if (!cancelled) router.replace("/login");
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-[calc(100vh-65px)]">
      <div className="app-shell">
        <div className="card mx-auto max-w-lg p-8 text-slate-700">
          <div className="text-sm font-semibold text-slate-900">Signing you in…</div>
          <div className="mt-2 text-sm text-slate-600">
            Finishing secure login and redirecting to your portal.
          </div>
        </div>
      </div>
    </main>
  );
}
