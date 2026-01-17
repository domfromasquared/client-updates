"use client";

import { supabase } from "@/lib/supabase/client";

export default function StatusPage() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-white">
      <h1 className="text-3xl font-bold">You are logged in 🎉</h1>
      <button
        onClick={handleLogout}
        className="rounded-xl bg-slate-900 px-6 py-3 text-white font-semibold"
      >
        Log out
      </button>
    </main>
  );
}
