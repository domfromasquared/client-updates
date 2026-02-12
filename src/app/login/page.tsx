"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

type AllowlistResponse = { ok: true; allowed: boolean } | { ok: false; reason?: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setToast("");

    if (cooldownLeft > 0) {
      setToast(`Please wait ${cooldownLeft}s before requesting another link.`);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setToast("Enter your email address.");
      return;
    }

    setLoading(true);

    // Gate requests so we only send magic links to approved emails.
    const allowRes = await fetch("/api/auth/allowed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const allowJson = (await allowRes.json().catch(() => ({}))) as AllowlistResponse;

    if (!allowRes.ok || !("ok" in allowJson) || !allowJson.ok || !allowJson.allowed) {
      setToast("This email is not authorized for portal access. Contact our team for access.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Do not auto-create users for unknown emails.
        shouldCreateUser: false,
      },
    });

    if (error) {
      setToast("We couldn't send the login link right now. Please wait a moment and try again.");
      setLoading(false);
      return;
    }

    setSent(true);
    setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
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
            We&apos;ll email you a secure magic link to access your portal.
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

              <button disabled={loading || cooldownLeft > 0} className="btn-primary w-full py-3">
                {loading
                  ? "Sending…"
                  : cooldownLeft > 0
                    ? `Wait ${cooldownLeft}s`
                    : "Send login link"}
              </button>
            </form>
          ) : (
            <div className="mt-8 card-solid p-6">
              <div className="text-sm font-semibold text-slate-900">Link sent</div>
              <p className="mt-1 text-sm text-slate-600">
                If you&apos;re authorized, check your email for a login link.
              </p>
              <button
                onClick={() => setSent(false)}
                disabled={cooldownLeft > 0}
                className="btn-secondary mt-4 w-full py-3"
              >
                {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : "Use a different email"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
