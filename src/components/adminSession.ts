"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AdminRequest = (url: string, init?: RequestInit) => Promise<Response>;

type Session = { controller: AbortController; expiresAt: number };

export function useAdminSession() {
  const current = useRef<Session | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<"failed" | "limited" | "expired" | "logout" | null>(null);

  const clear = useCallback((reason: typeof error = null) => {
    current.current?.controller.abort();
    current.current = null;
    setSession(null);
    setError(reason);
  }, []);

  const accept = useCallback((expiresAt: number) => {
    current.current?.controller.abort();
    const next = { controller: new AbortController(), expiresAt };
    current.current = next;
    setSession(next);
    setError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/auth/session", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
      .then(async response => {
        const data = await response.json();
        if (!controller.signal.aborted && response.ok && data.authenticated) accept(data.expiresAt);
      }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => { controller.abort(); current.current?.controller.abort(); };
  }, [accept]);

  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    let checkingStatus = false;
    const check = async () => {
      if (checkingStatus || current.current !== session) return;
      checkingStatus = true;
      clearTimeout(timer);
      try {
        const response = await fetch("/api/admin/auth/session", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([session.controller.signal, AbortSignal.timeout(5000)]) });
        const data = await response.json();
        if (current.current !== session) return;
        if (!response.ok || !data.authenticated || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) clear("expired");
        else session.expiresAt = data.expiresAt;
      } catch {
        // Keep a brief outage usable only until the last server-confirmed deadline.
        if (current.current === session && Date.now() >= session.expiresAt) clear("expired");
      } finally {
        checkingStatus = false;
        if (current.current === session) schedule();
      }
    };
    function schedule() {
      timer = setTimeout(() => void check(), Math.min(30_000, Math.max(0, session!.expiresAt - Date.now())));
    }
    schedule();
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(timer); window.removeEventListener("focus", onFocus); };
  }, [session, clear]);

  const request: AdminRequest = useCallback(async (url, init = {}) => {
    const active = current.current;
    if (!active) throw new Error("Authentication required");
    const headers = new Headers(init.headers);
    if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) headers.set("x-admin-csrf", "1");
    const signals = [active.controller.signal, AbortSignal.timeout(130_000)];
    if (init.signal) signals.push(init.signal);
    const response = await fetch(url, { ...init, headers, credentials: "same-origin", cache: "no-store", signal: AbortSignal.any(signals) });
    if (current.current !== active) throw new DOMException("Session changed", "AbortError");
    if (response.status === 401 || response.status === 503) {
      clear("expired");
      throw new Error("Authentication required");
    }
    return response;
  }, [clear]);

  async function login(token: string) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json", "x-admin-csrf": "1" },
        body: JSON.stringify({ token }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) { setError(response.status === 429 ? "limited" : "failed"); return false; }
      const data = await response.json();
      accept(data.expiresAt);
      return true;
    } catch { setError("failed"); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function logout() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    // Remove protected views immediately; revoke the server session independently.
    clear();
    try {
      const response = await fetch("/api/admin/auth/logout", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "x-admin-csrf": "1" }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) setError("logout");
    } catch { setError("logout"); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return { session, checking, busy, error, login, logout, request };
}
