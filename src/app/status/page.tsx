"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PortalRow = {
  project: string;
  task: string;
  status: string;
  estimated_completion: string;
  actual_completion: string;
};

type StatusResponse =
  | { ok: true; client_name: string; last_updated: string; rows: PortalRow[] }
  | { ok: false; reason?: string; error?: string };

export default function StatusPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [clientName, setClientName] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [rows, setRows] = useState<PortalRow[]>([]);

  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [sendingRow, setSendingRow] = useState<number | null>(null);
  const [cooldownRow, setCooldownRow] = useState<number | null>(null);

  const [toast, setToast] = useState<string>("");
  const toastTimerRef = useRef<number | null>(null);

  function showToast(message: string) {
    setToast(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 4500);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkSessionWithRetry() {
      for (let i = 0; i < 12; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) setChecking(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled) router.replace("/login");
    }

    checkSessionWithRetry();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function fetchStatus() {
    setLoadingData(true);
    setToast("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const res = await fetch("/api/status", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = (await res.json().catch(() => ({}))) as StatusResponse;

    if (!res.ok || !("ok" in json) || json.ok === false) {
      const reason = (json as any)?.reason || (json as any)?.error || `HTTP ${res.status}`;
      if (reason === "not_allowed") {
        router.replace("/login");
        return;
      }
      showToast(`Couldn’t load status: ${reason}`);
      setLoadingData(false);
      return;
    }

    setClientName(json.client_name);
    setLastUpdated(json.last_updated);
    setRows(json.rows);
    setLoadingData(false);
  }

  useEffect(() => {
    if (!checking) fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const safeTitle = useMemo(() => clientName || "Client Portal", [clientName]);

  async function submitNote(rowIndex: number) {
    const row = rows[rowIndex];
    const note = (notesDraft[rowIndex] || "").trim();

    if (!note) {
      showToast("Add a note before sending.");
      return;
    }

    setSendingRow(rowIndex);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      showToast("Session missing. Please log in again.");
      setSendingRow(null);
      return;
    }

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client_name: clientName,
        project: row.project,
        task: row.task,
        note,
      }),
    });

    const json = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      showToast(
        `Couldn’t send note (HTTP ${res.status}): ${json?.error || json?.reason || "Unknown error"}`
      );
      setSendingRow(null);
      return;
    }

    // Clear the draft
    setNotesDraft((prev) => ({ ...prev, [rowIndex]: "" }));

    // UX: disable button briefly after success (prevents spam/double-click)
    setSendingRow(null);
    setCooldownRow(rowIndex);

    showToast(`Note sent.`);

    window.setTimeout(() => {
      setCooldownRow((current) => (current === rowIndex ? null : current));
    }, 1500);
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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{safeTitle}</h1>
            <div className="mt-2 text-sm text-slate-600">
              Last updated{" "}
              <span className="font-semibold text-slate-900">{lastUpdated || "—"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchStatus}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Log out
            </button>
          </div>
        </div>

        {toast ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {toast}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
            <div className="text-sm font-semibold text-slate-900">Projects & Tasks</div>
            <div className="mt-1 text-sm text-slate-600">
              {loadingData ? "Loading…" : `${rows.length} items`}
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-6 py-3 font-semibold">Project</th>
                  <th className="px-6 py-3 font-semibold">Task</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Est. Complete</th>
                  <th className="px-6 py-3 font-semibold">Actual Complete</th>
                  <th className="px-6 py-3 font-semibold">Notes to send</th>
                </tr>
              </thead>

              <tbody>
                {loadingData ? (
                  <tr>
                    <td className="px-6 py-6 text-slate-600" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((r, i) => {
                    const isSending = sendingRow === i;
                    const isCooldown = cooldownRow === i;
                    const disabled = isSending || isCooldown;

                    return (
                      <tr key={i} className="border-t border-slate-200 align-top">
                        <td className="px-6 py-4 font-semibold text-slate-900">{r.project || "—"}</td>
                        <td className="px-6 py-4 text-slate-800">{r.task || "—"}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800">
                            {r.status || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-800">{r.estimated_completion || "—"}</td>
                        <td className="px-6 py-4 text-slate-800">{r.actual_completion || "—"}</td>

                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <textarea
                              value={notesDraft[i] || ""}
                              onChange={(e) =>
                                setNotesDraft((p) => ({ ...p, [i]: e.target.value }))
                              }
                              placeholder="Type notes for this item…"
                              rows={2}
                              className="w-full min-w-[320px] resize-y rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                            />
                            <button
                              onClick={() => submitNote(i)}
                              disabled={disabled}
                              className="h-fit rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {isSending ? "Sending…" : isCooldown ? "Sent" : "Send"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-6 text-slate-600" colSpan={6}>
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Notes are delivered to a private log for your team to review and respond.
        </div>
      </div>
    </main>
  );
}
