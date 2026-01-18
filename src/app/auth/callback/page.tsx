"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (error) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      router.replace("/status");
    })();
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
