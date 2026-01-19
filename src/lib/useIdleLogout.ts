"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Options = {
  idleMs?: number;              // default 30 minutes
  redirectTo?: string;          // default /login
  storageKey?: string;          // default shared key across tabs
};

export function useIdleLogout(enabled: boolean, options: Options = {}) {
  const router = useRouter();

  const idleMs = options.idleMs ?? 30 * 60 * 1000; // 30 minutes
  const redirectTo = options.redirectTo ?? "/login";
  const storageKey = options.storageKey ?? "client_portal_last_activity";

  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function doLogout(reason: string) {
    clearTimer();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    // Optional: include reason (handy for future)
    router.replace(`${redirectTo}?reason=${encodeURIComponent(reason)}`);
  }

  function setActivityNow() {
    const now = Date.now();
    try {
      localStorage.setItem(storageKey, String(now));
    } catch {
      // ignore (private mode / blocked storage)
    }
  }

  function scheduleCheck() {
    clearTimer();

    const check = async () => {
      let last = Date.now();
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) last = Number(raw) || last;
      } catch {
        // ignore
      }

      const idleFor = Date.now() - last;

      if (idleFor >= idleMs) {
        await doLogout("idle_timeout");
        return;
      }

      // schedule next check right when it would expire
      const remaining = idleMs - idleFor;
      timerRef.current = window.setTimeout(check, remaining + 250);
    };

    // check soon, then it self-schedules accurately
    timerRef.current = window.setTimeout(check, 1000);
  }

  useEffect(() => {
    if (!enabled) return;

    // initialize "last activity" if missing
    try {
      if (!localStorage.getItem(storageKey)) setActivityNow();
    } catch {
      // ignore
    }

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ];

    const onActivity = () => {
      setActivityNow();
      scheduleCheck();
    };

    // reset timer when user is active
    activityEvents.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    // cross-tab sync: if another tab updates activity, refresh our timer
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) scheduleCheck();
    };
    window.addEventListener("storage", onStorage);

    // start timer
    scheduleCheck();

    return () => {
      clearTimer();
      activityEvents.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idleMs, redirectTo, storageKey]);
}