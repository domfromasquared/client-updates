"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function StatusPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;

    async function init() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email ?? null);
      setChecking(false);

      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!newSession) router.replace("/login");
      });

      unsub = listener.subscription;
    }

    init();

    return () => {
      unsub?.unsubscribe();
    };
  }, [router]);

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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Project Status</h1>
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
          Next step: we’ll replace this placeholder with your real client status UI and data from Google Sheets.
        </div>
      </div>
    </main>
  );
}
