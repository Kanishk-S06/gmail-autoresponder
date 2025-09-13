"use client";
import { useEffect, useState } from "react";

type Item = {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
};

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);
  const [draftingId, setDraftingId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/gmail/list");
      if (!res.ok) throw new Error("not connected");
      const data = await res.json();
      setItems(data.items ?? []);
      setConnected(true);
    } catch {
      setConnected(false);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* HEADER */}
      <header className="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <h1 className="text-lg font-semibold tracking-tight">
              Gmail Auto-Responder
            </h1>
            <span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-slate-600">
              Draft-only
            </span>
          </div>
          <div className="flex items-center gap-3">
            {connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600"></span>
                Not connected
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {!connected ? (
          <ConnectCallout />
        ) : (
          <>
            {items.length === 0 && !loading ? (
              <EmptyState />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {items.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-600">
                          From: <span className="font-medium">{m.from}</span>
                        </div>
                        <div className="mt-1 truncate text-[15px] font-semibold">
                          {m.subject}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-slate-500">
                        {m.date}
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-3 text-sm text-slate-700">
                      {m.snippet}
                    </p>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={async () => {
                          try {
                            setDraftingId(m.id);
                            const res = await fetch("/api/gmail/draft", {
                              method: "POST",
                              body: JSON.stringify({ messageId: m.id }),
                            });
                            const j = await res.json();
                            alert(
                              j.draftId
                                ? `Draft created: ${j.draftId}`
                                : "Failed to create draft"
                            );
                          } finally {
                            setDraftingId(null);
                          }
                        }}
                        disabled={draftingId === m.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-70"
                      >
                        {draftingId === m.id ? (
                          <>
                            <Spinner />
                            Creating…
                          </>
                        ) : (
                          "Generate Draft"
                        )}
                      </button>

                      {/* NEW: Learn from my edit */}
                      <button
                        className="rounded border px-3 py-2 text-sm"
                        onClick={async () => {
                          const edited = prompt(
                            "Paste your final edited draft to learn:"
                          );
                          if (!edited) return;
                          await fetch("/api/ai/learn", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sender: m.from.match(/<([^>]+)>/)?.[1] || m.from,
                              original: "", // optional for now
                              edited,
                            }),
                          });
                          alert("Learned from your edit ✅");
                        }}
                      >
                        Learn from my edit
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {loading && <ListSkeleton />}
          </>
        )}
      </main>
    </div>
  );
}

/* ---------- Small UI helpers (no extra libraries) ---------- */

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-slate-100"></div>
      <h2 className="text-base font-semibold">No emails to show</h2>
      <p className="mt-1 text-sm text-slate-600">
        Your inbox preview is empty. Click{" "}
        <span className="font-medium">Refresh</span> or try again later.
      </p>
      <a
        href="https://mail.google.com/mail/u/0/#drafts"
        target="_blank"
        className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Open Gmail Drafts
      </a>
    </div>
  );
}

function ConnectCallout() {
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-6">
      <h2 className="text-base font-semibold text-amber-900">
        Connect your Gmail
      </h2>
      <p className="mt-1 text-sm text-amber-900/80">
        Authorize access to list your recent emails and create reply drafts. We
        will not send emails automatically.
      </p>
      <a
        href="/api/oauth/google"
        className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-500"
      >
        Connect Gmail
      </a>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="mt-6 grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
          </div>
          <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-10 w-full rounded bg-slate-100" />
          <div className="mt-4 ml-auto h-9 w-32 rounded bg-slate-200" />
        </li>
      ))}
    </ul>
  );
}
