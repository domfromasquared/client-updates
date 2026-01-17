"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function StatusPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<string>("");

  useEffect(() => {
  let cancelled = false;

  async function checkSessionWithRetry() {
    for (let i = 0; i < 12; i++) {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (session) {
        if (!cancelled) {
          setEmail(session.user.email ?? null);
          setChecking(false);
        }
        return;
      }

      // wait 250ms and try again (total ~3 seconds)
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!cancelled) router.replace("/login");
  }

  checkSessionWithRetry();

  return () => {
    cancelled = true;
  };
}, [router]);


  async function callApiWithoutToken() {
    setApiResult("Calling /api/status without token…");
    const res = await fetch("/api/status");
    const json = await res.json().catch(() => ({}));
    setApiResult(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }

  async function callApiWithToken() {
    setApiResult("Calling /api/status with token…");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const res = await fetch("/api/status", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => ({}));
    setApiResult(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
          Checking access…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-extrabold text-slate-900">Status (Test Mode)</h1>
          <button
            onClick={handleLogout}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Log out
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
          Logged in as <span className="font-semibold text-slate-900">{email}</span>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 p-6">
          <div className="text-sm font-semibold text-slate-900">API Lock Test</div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={callApiWithoutToken}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              Call without token (expect 401)
            </button>
            <button
              onClick={callApiWithToken}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Call with token (expect 200)
            </button>
          </div>

          {apiResult ? (
            <pre className="mt-4 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-800">
{apiResult}
            </pre>
          ) : null}
        </div>
      </div>
    </main>
  );
}
