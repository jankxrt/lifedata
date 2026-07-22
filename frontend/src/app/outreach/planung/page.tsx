"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { ABHEntry } from '@/lib/supabase';
import { parteiCls } from '@/lib/partei';

type DistMode = 'sequential' | 'distributed';

function formatEinwohner(raw: string | null): string {
  if (!raw) return '—';
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  if (isNaN(n)) return raw;
  return n.toLocaleString('de-DE');
}

/** Round-robin pick from each Bundesland so the batch covers all states evenly. */
function distributeAcrossStates(entries: ABHEntry[], total: number): ABHEntry[] {
  const byState = new Map<string, ABHEntry[]>();
  for (const e of entries) {
    const land = e.land ?? 'Unbekannt';
    if (!byState.has(land)) byState.set(land, []);
    byState.get(land)!.push(e);
  }
  const groups = [...byState.values()].sort((a, b) => b.length - a.length);
  const result: ABHEntry[] = [];
  let round = 0;
  while (result.length < total) {
    let added = false;
    for (const group of groups) {
      if (group.length > round && result.length < total) {
        result.push(group[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return result;
}

export default function PlanungPage() {
  const [allABH, setAllABH]               = useState<ABHEntry[]>([]);
  const [leadNames, setLeadNames]         = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(true);
  const [count, setCount]                 = useState(10);
  const [distMode, setDistMode]           = useState<DistMode>('sequential');
  const [excludedStates, setExcludedStates] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds]         = useState<Set<number>>(new Set());
  const [addingAll, setAddingAll]         = useState(false);

  useEffect(() => {
    async function load() {
      const [abhRes, leadsRes] = await Promise.all([
        supabase.from('auslaenderbehoerden').select('*').order('name'),
        supabase.from('leads').select('name'),
      ]);
      if (abhRes.data)   setAllABH(abhRes.data);
      if (leadsRes.data) setLeadNames(new Set(leadsRes.data.map((l: { name: string }) => l.name)));
      setLoading(false);
    }
    load();
  }, []);

  /** All ABHs not yet in outreach. */
  const uncontacted = useMemo(
    () => allABH.filter(e => !leadNames.has(e.name)),
    [allABH, leadNames],
  );

  /** Uncontacted entries after removing excluded states. Used as the pool for `shown`. */
  const filteredUncontacted = useMemo(
    () => excludedStates.size === 0
      ? uncontacted
      : uncontacted.filter(e => !excludedStates.has(e.land ?? 'Unbekannt')),
    [uncontacted, excludedStates],
  );

  /** Total uncontacted per state (across all states, before exclusions). */
  const uncontactedByState = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of uncontacted) {
      const land = e.land ?? 'Unbekannt';
      map.set(land, (map.get(land) ?? 0) + 1);
    }
    return map;
  }, [uncontacted]);

  /** All states sorted alphabetically, shown as chips. */
  const allStates = useMemo(
    () => [...uncontactedByState.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de')),
    [uncontactedByState],
  );

  /** The entries currently displayed in the table. */
  const shown = useMemo(() => {
    const n = Math.max(1, count);
    if (distMode === 'sequential') return filteredUncontacted.slice(0, n);
    return distributeAcrossStates(filteredUncontacted, n);
  }, [filteredUncontacted, count, distMode]);

  /** How many from each state are currently in `shown` (for distributed mode chips). */
  const shownByState = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of shown) {
      const land = e.land ?? 'Unbekannt';
      map.set(land, (map.get(land) ?? 0) + 1);
    }
    return map;
  }, [shown]);

  /** Table rows, annotated with state-group divider flags for distributed mode. */
  const shownForTable = useMemo(() => {
    if (distMode !== 'distributed') {
      return shown.map(e => ({ entry: e, isFirstOfState: false }));
    }
    const sorted = [...shown].sort((a, b) =>
      (a.land ?? 'Unbekannt').localeCompare(b.land ?? 'Unbekannt', 'de'),
    );
    let lastLand = '';
    return sorted.map(e => {
      const land = e.land ?? 'Unbekannt';
      const isFirstOfState = land !== lastLand;
      lastLand = land;
      return { entry: e, isFirstOfState };
    });
  }, [shown, distMode]);

  const contactedCount = allABH.length - uncontacted.length;
  const progressPct    = allABH.length > 0 ? Math.round((contactedCount / allABH.length) * 100) : 0;
  const pendingShown   = shown.filter(e => !leadNames.has(e.name)).length;

  function toggleState(land: string) {
    setExcludedStates(prev => {
      const next = new Set(prev);
      if (next.has(land)) next.delete(land);
      else next.add(land);
      return next;
    });
  }

  async function addOne(entry: ABHEntry) {
    if (addingIds.has(entry.id) || leadNames.has(entry.name)) return;
    setAddingIds(prev => new Set([...prev, entry.id]));
    const einwStr = entry.einwohner?.replace(/\D/g, '');
    const { error } = await supabase.from('leads').insert({
      name: entry.name, stadt: entry.stadt || null, land: entry.land || null,
      buergermeister: entry.buergermeister || null, partei: entry.partei || null,
      kontaktdaten: entry.kontaktdaten || null,
      einwohner: einwStr ? parseInt(einwStr, 10) : null,
      von: null, notes: null, status: 'neu',
    });
    if (!error) setLeadNames(prev => new Set([...prev, entry.name]));
    setAddingIds(prev => { const next = new Set(prev); next.delete(entry.id); return next; });
  }

  async function addAllShown() {
    const toAdd = shown.filter(e => !leadNames.has(e.name) && !addingIds.has(e.id));
    if (toAdd.length === 0) return;
    setAddingAll(true);
    setAddingIds(prev => new Set([...prev, ...toAdd.map(e => e.id)]));
    await Promise.all(toAdd.map(async entry => {
      const einwStr = entry.einwohner?.replace(/\D/g, '');
      const { error } = await supabase.from('leads').insert({
        name: entry.name, stadt: entry.stadt || null, land: entry.land || null,
        buergermeister: entry.buergermeister || null, partei: entry.partei || null,
        kontaktdaten: entry.kontaktdaten || null,
        einwohner: einwStr ? parseInt(einwStr, 10) : null,
        von: null, notes: null, status: 'neu',
      });
      if (!error) setLeadNames(prev => new Set([...prev, entry.name]));
      setAddingIds(prev => { const next = new Set(prev); next.delete(entry.id); return next; });
    }));
    setAddingAll(false);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">

        {/* Header */}
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Planung</h1>
          {!loading && (
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {uncontacted.length} von {allABH.length} ABHs noch nicht kontaktiert
              {excludedStates.size > 0 && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  · {excludedStates.size} Bundesland{excludedStates.size > 1 ? 'er' : ''} ausgeschlossen
                </span>
              )}
            </p>
          )}
        </header>

        {/* Control card */}
        {loading ? (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-6 text-sm text-[color:var(--muted)] shadow-sm">
            Lade Daten…
          </div>
        ) : (
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">

            {/* Row 1: stats + controls */}
            <div className="flex flex-wrap items-center gap-5">
              {/* Big counter */}
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums">{uncontacted.length}</span>
                <span className="text-sm text-[color:var(--muted)]">nicht kontaktiert</span>
              </div>

              <div className="hidden h-10 w-px bg-[color:var(--border)] sm:block" />

              {/* Progress bar */}
              <div className="flex min-w-[150px] flex-col gap-1.5">
                <div className="flex justify-between text-xs text-[color:var(--muted)]">
                  <span>{contactedCount} kontaktiert</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                  <div className="h-full rounded-full bg-[color:var(--foreground)] transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <div className="hidden h-10 w-px bg-[color:var(--border)] sm:block" />

              {/* Count input */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-[color:var(--muted-strong)]">Zeige</label>
                <input
                  type="number"
                  min={1}
                  max={filteredUncontacted.length || 1}
                  value={count}
                  onChange={e => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-9 w-20 rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm tabular-nums shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                />
                <span className="text-sm text-[color:var(--muted)]">Einträge</span>
              </div>

              {/* Distribution mode toggle */}
              <div className="inline-flex overflow-hidden rounded-lg border border-[color:var(--border)] text-xs font-medium">
                <button
                  onClick={() => setDistMode('sequential')}
                  className={`px-3 py-2 transition-colors ${
                    distMode === 'sequential'
                      ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                      : 'bg-[color:var(--surface-muted)] text-[color:var(--muted-strong)] hover:bg-[color:var(--surface-hover)]'
                  }`}
                >
                  Alphabetisch
                </button>
                <button
                  onClick={() => setDistMode('distributed')}
                  className={`border-l border-[color:var(--border)] px-3 py-2 transition-colors ${
                    distMode === 'distributed'
                      ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                      : 'bg-[color:var(--surface-muted)] text-[color:var(--muted-strong)] hover:bg-[color:var(--surface-hover)]'
                  }`}
                >
                  Nach Bundesland
                </button>
              </div>

              {/* Add-all button */}
              {pendingShown > 0 && (
                <button
                  onClick={addAllShown}
                  disabled={addingAll}
                  className="ml-auto inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {addingAll ? (
                    <>
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 20" />
                      </svg>
                      Wird hinzugefügt…
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      Alle {pendingShown} hinzufügen
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Row 2: state chips — always visible, clickable to exclude */}
            {allStates.length > 0 && (
              <div className="mt-4 border-t border-[color:var(--border)] pt-4">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[color:var(--muted)]">
                    {distMode === 'distributed' && excludedStates.size === 0
                      ? `Verteilt auf ${shownByState.size} Bundesländer`
                      : 'Bundesländer'}
                    <span className="ml-1 font-normal opacity-70">— klicken zum Ausschließen</span>
                  </p>
                  {excludedStates.size > 0 && (
                    <button
                      onClick={() => setExcludedStates(new Set())}
                      className="text-xs text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)] underline-offset-2 hover:underline"
                    >
                      Alle einschließen
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allStates.map(([land, totalN]) => {
                    const excluded = excludedStates.has(land);
                    const selectedN = distMode === 'distributed' ? (shownByState.get(land) ?? 0) : null;
                    return (
                      <button
                        key={land}
                        onClick={() => toggleState(land)}
                        title={excluded ? `${land} wieder einschließen` : `${land} ausschließen`}
                        className={[
                          'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
                          excluded
                            ? 'border-red-200 bg-red-50 text-red-500 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
                            : 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--muted-strong)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]',
                        ].join(' ')}
                      >
                        {excluded ? (
                          <>
                            {/* X icon */}
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <span className="line-through opacity-70">{land}</span>
                          </>
                        ) : (
                          <>
                            <span>{land}</span>
                            {selectedN !== null ? (
                              <span className="tabular-nums">
                                <span className="font-semibold text-[color:var(--foreground)]">{selectedN}</span>
                                <span className="opacity-40">/{totalN}</span>
                              </span>
                            ) : (
                              <span className="font-semibold tabular-nums text-[color:var(--foreground)]">{totalN}</span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Table */}
        {!loading && (
          filteredUncontacted.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-16 text-center shadow-sm">
              <svg className="mx-auto mb-3 text-[color:var(--muted)]" width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {uncontacted.length === 0 ? (
                <>
                  <p className="text-sm font-medium">Alle ABHs sind bereits in Outreach</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">Es gibt keine nicht-kontaktierten Einträge mehr.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Keine Einträge nach Filterung</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Alle verbleibenden ABHs stammen aus ausgeschlossenen Bundesländern.
                  </p>
                  <button
                    onClick={() => setExcludedStates(new Set())}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]"
                  >
                    Alle Bundesländer einschließen
                  </button>
                </>
              )}
            </div>
          ) : (
            <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm text-[color:var(--muted-strong)]">
                  <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--muted)]">
                    <tr className="bg-[color:var(--surface-muted)]">
                      <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold" style={{ minWidth: 220 }}>Name</th>
                      <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold" style={{ minWidth: 110 }}>Stadt</th>
                      <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold" style={{ minWidth: 140 }}>Bundesland</th>
                      <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold" style={{ minWidth: 100 }}>Größe</th>
                      <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold" style={{ minWidth: 90 }}>Partei</th>
                      <th className="border-b border-[color:var(--border)] px-4 py-3" style={{ minWidth: 150 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {shownForTable.map(({ entry, isFirstOfState }) => {
                      const isAdding = addingIds.has(entry.id);
                      const isAdded  = leadNames.has(entry.name);
                      return (
                        <>
                          {isFirstOfState && (
                            <tr key={`hdr-${entry.land}`}>
                              <td
                                colSpan={6}
                                className="border-b border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]"
                              >
                                {entry.land ?? 'Unbekannt'}
                              </td>
                            </tr>
                          )}
                          <tr key={entry.id} className="hover:bg-[color:var(--surface-hover)] transition-colors">
                            <td className="px-4 py-2.5 align-middle font-medium">{entry.name}</td>
                            <td className="px-4 py-2.5 align-middle">{entry.stadt || '—'}</td>
                            <td className="px-4 py-2.5 align-middle">{entry.land || '—'}</td>
                            <td className="px-4 py-2.5 align-middle tabular-nums text-[color:var(--muted)]">
                              {formatEinwohner(entry.einwohner)}
                            </td>
                            <td className="px-4 py-2.5 align-middle">
                              {entry.partei ? (
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${parteiCls(entry.partei)}`}>
                                  {entry.partei}
                                </span>
                              ) : (
                                <span className="text-[color:var(--muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 align-middle text-right">
                              {isAdded ? (
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-green-600 dark:text-green-400">
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  Hinzugefügt
                                </span>
                              ) : (
                                <button
                                  onClick={() => addOne(entry)}
                                  disabled={isAdding}
                                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                                >
                                  {isAdding ? (
                                    <>
                                      <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 20" />
                                      </svg>
                                      Wird hinzugefügt…
                                    </>
                                  ) : (
                                    <>
                                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                      </svg>
                                      Zu Outreach
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredUncontacted.length > count && (
                <div className="border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--muted)]">
                  {filteredUncontacted.length - Math.min(count, filteredUncontacted.length)} weitere Einträge nicht angezeigt — erhöhe die Anzahl oben
                </div>
              )}
            </section>
          )
        )}
      </div>
    </main>
  );
}
