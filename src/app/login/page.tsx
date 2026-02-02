"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setToast("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setToast(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="min-h-[calc(100vh-65px)]">
      <div className="app-shell">
        <div className="card mx-auto max-w-lg p-8 sm:p-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Client Login
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            We’ll email you a secure magic link to access your portal.
          </p>

          {toast ? <div className="toast mt-6 text-slate-700">{toast}</div> : null}

          {!sent ? (
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900">Email</label>
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input mt-2"
                />
              </div>

              <button disabled={loading} className="btn-primary w-full py-3">
                {loading ? "Sending…" : "Send login link"}
              </button>

              <p className="text-xs text-slate-500">
                Tip: check spam the first time, then mark as “Not spam.”
              </p>
            </form>
          ) : (
            <div className="mt-8 card-solid p-6">
              <div className="text-sm font-semibold text-slate-900">Link sent</div>
              <p className="mt-1 text-sm text-slate-600">
                If you’re authorized, check your email for a login link.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
