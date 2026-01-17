"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/status`,
      },
    });

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Client Login</h1>

        {!sent ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900"
            />
            <button
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 py-3 text-white font-semibold disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send login link"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-slate-700">
            If you’re authorized, check your email for a login link.
          </p>
        )}
      </div>
    </main>
  );
}
