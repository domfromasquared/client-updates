"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = window.location.href;

        // Supabase magic links may be:
        // - PKCE code flow: ?code=...
        // - Hash token flow: #access_token=...
        const hasCode = url.includes("?code=") || url.includes("&code=");

        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            if (!cancelled) router.replace("/login");
            return;
          }
        } else {
          // Hash token flow (older/alternate format)
          // Typings vary by supabase-js version; runtime supports it.
          // @ts-ignore
          const { error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
          if (error) {
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
