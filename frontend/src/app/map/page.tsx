"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import type { ABHEntry } from "@/lib/supabase";

type LeafletMapProps = { entries: ABHEntry[]; radiusActive: boolean; onRadiusEntries: (e: ABHEntry[] | null) => void; };
const LeafletMapComponent = dynamic(() => import("./LeafletMap"), { ssr: false, loading: () => null }) as React.FC<LeafletMapProps>;

const VON_OPTIONS = ["Ramin Goo", "Jan Kortmann", "Isabel Magallanes", "Barbara Stasiak"];

type SortKey = "name" | "stadt" | "adresse";

function AddLeadModal({ name, onConfirm, onCancel }: {
  name: string;
  onConfirm: (von: string | null, notes: string) => void;
  onCancel: () => void;
}) {
  const [von, setVon] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="animate-scale-in relative w-full max-w-md rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-0.5 text-base font-semibold text-[color:var(--foreground)]">Lead hinzufügen</h2>
        <p className="mb-5 text-sm text-[color:var(--muted)] line-clamp-1">{name}</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[color:var(--muted-strong)]">Zuständig</label>
            <div className="relative">
              <select
                value={von}
                onChange={e => setVon(e.target.value)}
                autoFocus
                className="h-10 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
              >
                <option value="">Nicht zugewiesen</option>
                {VON_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[color:var(--muted-strong)]">Anmerkungen</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optionale Notizen zum Lead…"
              rows={3}
              className="w-full resize-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(von || null, notes)}
            className="h-9 rounded-md bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  const [entries, setEntries]             = useState<ABHEntry[]>([]);
  const [radiusActive, setRadiusActive]   = useState(false);
  const [radiusEntries, setRadiusEntries] = useState<ABHEntry[] | null>(null);

  // Lead state
  const [leadStatus, setLeadStatus]       = useState<Map<string, string>>(new Map());
  const [addingLead, setAddingLead]       = useState<string | null>(null);
  const [pendingEntry, setPendingEntry]   = useState<ABHEntry | null>(null);

  // Results-list sort/filter
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter]   = useState("");

  useEffect(() => {
    supabase.from("auslaenderbehoerden").select("*").order("name").then(({ data }) => {
      if (data) setEntries(data);
    });
  }, []);

  // Load existing lead statuses
  useEffect(() => {
    supabase.from("leads").select("name, status").then(({ data }) => {
      if (data) setLeadStatus(new Map(data.map((r: { name: string; status: string }) => [r.name, r.status])));
    });
  }, []);

  async function addLead(entry: ABHEntry, von: string | null, notes: string) {
    if (!entry.name || leadStatus.has(entry.name)) return;
    setAddingLead(entry.name);
    const einwStr = entry.einwohner?.replace(/\D/g, "");
    await supabase.from("leads").insert({
      name:          entry.name,
      stadt:         entry.stadt          || null,
      land:          entry.land           || null,
      buergermeister: entry.buergermeister || null,
      partei:        entry.partei         || null,
      kontaktdaten:  entry.kontaktdaten   || null,
      einwohner:     einwStr ? parseInt(einwStr, 10) : null,
      von,
      notes:         notes || null,
    });
    setLeadStatus(prev => new Map([...prev, [entry.name, "neu"]]));
    setAddingLead(null);
  }

  function toggleRadius() {
    if (radiusActive) {
      setRadiusActive(false);
      setRadiusEntries(null);
      setFilter("");
    } else {
      setRadiusActive(true);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sortedResults = useMemo(() => {
    if (!radiusEntries) return [];
    const q = filter.trim().toLowerCase();
    const list = q
      ? radiusEntries.filter(e =>
          e.name.toLowerCase().includes(q) ||
          e.stadt.toLowerCase().includes(q) ||
          (e.adresse ?? "").toLowerCase().includes(q)
        )
      : radiusEntries;
    return [...list].sort((a, b) => {
      const va = (a[sortKey] ?? "") as string;
      const vb = (b[sortKey] ?? "") as string;
      return sortAsc ? va.localeCompare(vb, "de") : vb.localeCompare(va, "de");
    });
  }, [radiusEntries, filter, sortKey, sortAsc]);

  const subtitle = radiusActive
    ? radiusEntries !== null
      ? `${radiusEntries.length} ABH${radiusEntries.length !== 1 ? "s" : ""} im Umkreis gefunden.`
      : "Klicke auf die Karte, um den Mittelpunkt zu setzen."
    : entries.length > 0
      ? `${entries.length} Standorte eingetragen.`
      : "Keine Koordinaten gefunden. Bitte zuerst den Scraper ausführen.";

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>;
  }

  const leadStatusClass: Record<string, string> = {
    neu:           "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    kontaktiert:   "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
    antwort:       "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    abgeschlossen: "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
    abgelehnt:     "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  };

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">

        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Karte</h1>
            <p className="text-sm text-[color:var(--muted)]">{subtitle}</p>
          </div>
          <button
            onClick={toggleRadius}
            className={[
              "mt-0.5 inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              radiusActive
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]",
            ].join(" ")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
            </svg>
            {radiusActive ? "Radius beenden" : "Radius suchen"}
          </button>
        </header>

        {/* Map */}
        <div className="relative overflow-hidden rounded-xl border border-[color:var(--border)] shadow-sm" style={{ height: 600 }}>
          <LeafletMapComponent
            entries={entries}
            radiusActive={radiusActive}
            onRadiusEntries={setRadiusEntries}
          />
        </div>

        {/* Radius results list */}
        {radiusEntries !== null && (
          <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--muted-strong)]">
                Ergebnisse im Umkreis
                <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {sortedResults.length}
                </span>
              </p>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)] pointer-events-none" width="13" height="13" viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
                  <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Filtern…"
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] pl-7 pr-3 py-1.5 text-sm outline-none focus:border-violet-400 transition-colors w-44"
                />
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 360 }}>
              <table className="w-full border-collapse text-sm text-[color:var(--muted-strong)]">
                <thead className="sticky top-0 bg-[color:var(--surface-muted)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                  <tr>
                    {/* Lead button column */}
                    <th className="border-b border-[color:var(--border)] px-2 py-3 w-10" />
                    {(["name", "stadt", "adresse"] as SortKey[]).map(col => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className="cursor-pointer select-none border-b border-[color:var(--border)] px-4 py-3 text-left font-semibold hover:text-[color:var(--foreground)] transition-colors"
                      >
                        {col === "name" ? "Name" : col === "stadt" ? "Stadt" : "Adresse"}
                        <SortIcon col={col} />
                      </th>
                    ))}
                    {/* Lead status column */}
                    <th className="border-b border-[color:var(--border)] px-4 py-3 text-left font-semibold">Outreach</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[color:var(--muted)]">
                        Keine Ergebnisse.
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map(entry => {
                      const status   = leadStatus.get(entry.name);
                      const isLead   = !!status;
                      const isAdding = addingLead === entry.name;
                      return (
                        <tr key={entry.stadt} className="border-b border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] transition-colors">
                          {/* Add lead button */}
                          <td className="px-2 py-2.5 align-middle">
                            <button
                              onClick={() => { if (!isLead && !isAdding) setPendingEntry(entry); }}
                              disabled={isLead || isAdding}
                              title={isLead ? "Bereits als Lead gespeichert" : "Als Lead hinzufügen"}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
                                isLead
                                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300 cursor-default"
                                  : "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                              }`}
                            >
                              {isAdding ? "…" : isLead ? "✓" : "+"}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 font-medium">{entry.name}</td>
                          <td className="px-4 py-2.5">{entry.stadt}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-[color:var(--muted)]">{entry.adresse ?? "—"}</td>
                          {/* Lead status badge */}
                          <td className="px-4 py-2.5">
                            {status ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${leadStatusClass[status] ?? ""}`}>
                                {status}
                              </span>
                            ) : (
                              <span className="text-[color:var(--muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>

      {pendingEntry && (
        <AddLeadModal
          name={pendingEntry.name}
          onConfirm={(von, notes) => { addLead(pendingEntry, von, notes); setPendingEntry(null); }}
          onCancel={() => setPendingEntry(null)}
        />
      )}
    </main>
  );
}
