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

type NotesResponse =
  | { ok: true; updatedRange?: string }
  | { ok: false; reason?: string; error?: string };

function statusPillClass(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("complete")) return "pill pill-complete";
  if (s.includes("progress")) return "pill pill-progress";
  if (s.includes("not")) return "pill pill-notstarted";
  // fallback
  return "pill border border-slate-200 bg-slate-50 text-slate-800";
}

export default function StatusPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [clientName, setClientName] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [rows, setRows] = useState<PortalRow[]>([]);

  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [sendingRow, setSendingRow] = useState<number | null>(null);
  const [recentlySentRow, setRecentlySentRow] = useState<number | null>(null);
  const [toast, setToast] = useState<string>("");

  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4500);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
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

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace("/login");
      return;
    }

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

  const safeTitle = useMemo(() => clientName || "Project Status", [clientName]);

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

    const json = (await res.json().catch(() => ({}))) as NotesResponse;

    if (!res.ok || !("ok" in json) || json.ok === false) {
      const reason = (json as any)?.error || (json as any)?.reason || `HTTP ${res.status}`;
      showToast(`Couldn’t send note: ${reason}`);
      setSendingRow(null);
      return;
    }

    setNotesDraft((prev) => ({ ...prev, [rowIndex]: "" }));
    showToast(`Note sent${json.updatedRange ? ` (logged)` : ""}.`);

    // Disable the Send button briefly after success (quick win)
    setRecentlySentRow(rowIndex);
    window.setTimeout(() => setRecentlySentRow(null), 1500);

    setSendingRow(null);
  }

  if (checking) {
    return (
      <main className="min-h-[calc(100vh-65px)]">
        <div className="app-shell">
          <div className="card mx-auto max-w-lg p-6 text-slate-700">Checking access…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-65px)]">
      <div className="app-shell">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900">
              {safeTitle}
            </h1>
            <div className="mt-3 text-sm text-slate-600">
              Last updated{" "}
              <span className="font-semibold text-slate-900">{lastUpdated || "—"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={fetchStatus} className="btn-secondary">
              Refresh
            </button>
            <button onClick={handleLogout} className="btn-primary">
              Log out
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast ? <div className="toast mt-6 text-slate-700">{toast}</div> : null}

        {/* Summary strip */}
        <div className="card mt-8 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">Client</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{clientName || "—"}</div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500">Total items</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {loadingData ? "…" : rows.length}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500">Notes</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                Reply per row at the far right
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card-solid mt-8 overflow-hidden">
          <div className="border-b border-slate-200 bg-white/60 px-6 py-4">
            <div className="text-sm font-semibold text-slate-900">Projects & Tasks</div>
            <div className="mt-1 text-sm text-slate-600">
              {loadingData ? "Loading…" : `${rows.length} items`}
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1060px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left text-slate-600">
                  <th className="px-6 py-4 font-semibold">Project</th>
                  <th className="px-6 py-4 font-semibold">Task</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Estimated Completion</th>
                  <th className="px-6 py-4 font-semibold">Actual Completion</th>
                  <th className="px-6 py-4 font-semibold">Notes</th>
                </tr>
              </thead>

              <tbody>
                {loadingData ? (
                  <tr>
                    <td className="px-6 py-10 text-slate-600" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((r, i) => {
                    const disabled = sendingRow === i || recentlySentRow === i;
                    return (
                      <tr key={i} className="border-t border-slate-200 bg-white">
                        <td className="px-6 py-5 font-semibold text-slate-900">{r.project || "—"}</td>
                        <td className="px-6 py-5 text-slate-800">{r.task || "—"}</td>
                        <td className="px-6 py-5">
                          <span className={statusPillClass(r.status)}>{r.status || "—"}</span>
                        </td>
                        <td className="px-6 py-5 text-slate-800">{r.estimated_completion || "—"}</td>
                        <td className="px-6 py-5 text-slate-800">{r.actual_completion || "—"}</td>

                        <td className="px-6 py-5">
                          <div className="flex gap-2">
                            <textarea
                              value={notesDraft[i] || ""}
                              onChange={(e) => setNotesDraft((p) => ({ ...p, [i]: e.target.value }))}
                              placeholder="Type notes for this item…"
                              rows={2}
                              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10"
                            />
                            <button
                              onClick={() => submitNote(i)}
                              disabled={disabled}
                              className="btn-primary h-[42px] self-start px-4 text-xs"
                              title={recentlySentRow === i ? "Sent" : "Send"}
                            >
                              {sendingRow === i ? "Sending…" : recentlySentRow === i ? "Sent" : "Send"}
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Notes are sent to our secure private log.
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-10 text-slate-600" colSpan={6}>
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Need to update something? Send a note on the relevant row.
        </div>
      </div>
    </main>
  );
}
