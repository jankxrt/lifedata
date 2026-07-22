"use client";
import { useEffect, useMemo, useState } from 'react';
import { supabase, type Lead } from '@/lib/supabase';
import { parteiCls } from '@/lib/partei';
import { useDragScroll } from '@/lib/useDragScroll';
import { VERBINDLICHE_ZUSAGE, crmUrl } from '@/lib/crm';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M3 1h6v6M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SummaryPage() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const dragScroll            = useDragScroll();

  useEffect(() => {
    supabase
      .from('leads')
      .select('*')
      .eq('status', VERBINDLICHE_ZUSAGE)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setLeads(data ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      [l.name, l.stadt, l.land, l.partei, l.von, l.crm_id, l.notes]
        .some(v => v && v.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const withConsent = leads.filter(l => l.gdpr_consent).length;
  const missingCrm  = leads.filter(l => !l.crm_id).length;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">

        {/* Header */}
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Summary</h1>
            <span className="table-button border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700">
              {VERBINDLICHE_ZUSAGE}
            </span>
          </div>
          <p className="text-sm text-[color:var(--muted)]">
            Alle Leads mit verbindlicher Zusage – mit Direktlink ins CRM.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]">
            {error}
          </div>
        )}

        {/* Stat cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Verbindliche Zusagen</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{leads.length}</p>
            </div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Mit DSGVO-Einwilligung</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{withConsent}<span className="ml-1 text-sm font-medium text-[color:var(--muted)]">/ {leads.length}</span></p>
            </div>
            <div className="col-span-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-sm sm:col-span-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Ohne CRM-ID</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${missingCrm > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{missingCrm}</p>
            </div>
          </div>
        )}

        {/* Search */}
        {!loading && leads.length > 0 && (
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Suche nach Name, Stadt, Zuständig, CRM-ID…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-10 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-9 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>
          </section>
        )}

        {loading ? (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-6 text-sm text-[color:var(--muted-strong)] shadow-sm">
            Lade Zusagen…
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-[color:var(--foreground)]">Noch keine verbindlichen Zusagen</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Setze im <a href="/outreach" className="underline-offset-2 hover:underline">Outreach</a> den Status eines Leads auf „{VERBINDLICHE_ZUSAGE}".
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-[color:var(--foreground)]">Keine Ergebnisse für „{search}"</p>
            <button onClick={() => setSearch('')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">
              Suche zurücksetzen
            </button>
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
            <div ref={dragScroll.ref} className="overflow-x-auto cursor-grab"
              onMouseDown={dragScroll.onMouseDown} onMouseMove={dragScroll.onMouseMove}
              onMouseUp={dragScroll.onMouseUp} onMouseLeave={dragScroll.onMouseLeave}>
              <table className="w-full border-collapse text-sm text-[color:var(--muted-strong)]">
                <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--muted)]">
                  <tr className="bg-[color:var(--surface-muted)]">
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 220 }}>Name</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 110 }}>Stadt</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 130 }}>Bundesland</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 90 }}>Partei</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 150 }}>Zuständig</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 90 }}>DSGVO</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 100 }}>Hinzugefügt</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 150 }}>CRM</th>
                  </tr>
                </thead>
                <tbody key={filtered.map(l => l.id).join(',')}>
                  {filtered.map((lead, i) => (
                    <tr key={lead.id} className="animate-row-in hover:bg-[color:var(--surface-hover)] transition-colors"
                      style={{ animationDelay: `${i * 20}ms`, borderLeft: '3px solid #059669' }}>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="line-clamp-2 font-medium leading-snug">{lead.name}</div>
                        {lead.kontaktdaten && (
                          <a href={`mailto:${lead.kontaktdaten.split(/[;,]/)[0].trim()}`} className="font-mono text-xs text-[color:var(--muted)] hover:underline">
                            {lead.kontaktdaten.split(/[;,]/)[0].trim()}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">{lead.stadt ?? '—'}</td>
                      <td className="px-3 py-2.5 align-middle">{lead.land ?? '—'}</td>
                      <td className="px-3 py-2.5 align-middle">
                        {lead.partei ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${parteiCls(lead.partei)}`}>
                            {lead.partei}
                          </span>
                        ) : <span className="text-[color:var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {lead.von
                          ? <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{lead.von}</span>
                          : <span className="text-[color:var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className={`table-button border ${lead.gdpr_consent ? 'yes-sc' : 'no-sc'}`}>
                          {lead.gdpr_consent ? 'Ja' : 'Nein'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-xs tabular-nums text-[color:var(--muted)]">{formatDate(lead.created_at)}</span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {lead.crm_id ? (
                          <a href={crmUrl(lead.crm_id)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50">
                            CRM #{lead.crm_id}
                            <ExternalIcon />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-amber-600 dark:text-amber-400">
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M9 7h2v5H9V7Zm0 6h2v2H9v-2Z" fill="currentColor" /><path fillRule="evenodd" clipRule="evenodd" d="M10 1a9 9 0 1 0 0 18A9 9 0 0 0 10 1ZM3 10a7 7 0 1 1 14 0A7 7 0 0 1 3 10Z" fill="currentColor" /></svg>
                            CRM-ID fehlt
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
