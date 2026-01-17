"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      console.log("Callback hit:", window.location.href);

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      console.log("Code:", code ? "present" : "missing");

      if (!code) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      console.log("Exchange error:", error?.message ?? "none");

      if (error) {
        router.replace("/login");
        return;
      }

      router.replace("/status");
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
