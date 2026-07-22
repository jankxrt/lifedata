"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const StatisticsLeafletMap = dynamic(() => import("./StatisticsLeafletMap"), { ssr: false, loading: () => null });
import { supabase } from "@/lib/supabase";

const kontaktiertSet = new Set(["Y", "J", "YES", "JA"]);

const LEAD_STATUS_COLORS: Record<string, string> = {
  neu:                     "rgb(59,130,246)",
  kontaktiert:             "rgb(124,58,237)",
  antwort:                 "rgb(14,165,233)",
  zusage:                  "rgb(22,163,74)",
  "verbindliche Zusage":   "rgb(5,150,105)",
  abgeschlossen:           "rgb(22,163,74)",
  abgelehnt:               "rgb(220,38,38)",
};
const LEAD_STATUS_ORDER = ["neu", "kontaktiert", "antwort", "zusage", "verbindliche Zusage", "abgeschlossen", "abgelehnt"];

interface BundeslandStats { total: number; contacted: number }
interface SizeStats { total: number; contacted: number }

type SizeCategory = "Millionenstadt" | "Groß" | "Mittel" | "Klein" | "N.N.";

const SIZE_ORDER: SizeCategory[] = ["Millionenstadt", "Groß", "Mittel", "Klein", "N.N."];

const SIZE_META: Record<SizeCategory, { label: string; sub: string; color: string }> = {
  Millionenstadt: { label: "Millionenstadt",  sub: "≥ 1 Mio.",    color: "rgb(168,85,247)"  },
  Groß:           { label: "Großstadt",        sub: "100k–1 Mio.", color: "rgb(239,68,68)"   },
  Mittel:         { label: "Mittelstadt",       sub: "20k–100k",   color: "rgb(249,115,22)"  },
  Klein:          { label: "Kleinstadt",        sub: "< 20k",      color: "rgb(34,197,94)"   },
  "N.N.":         { label: "Unbekannt",         sub: "keine Angabe",color: "rgb(148,163,184)" },
};

function getCitySize(einwohner: string): SizeCategory {
  if (!einwohner || einwohner.trim() === "" || einwohner === "0" || einwohner === "#N/A") return "N.N.";
  const n = parseInt(einwohner.replace(/\D/g, ""), 10);
  if (isNaN(n) || n === 0) return "N.N.";
  if (n >= 1_000_000) return "Millionenstadt";
  if (n >= 100_000)   return "Groß";
  if (n >= 20_000)    return "Mittel";
  return "Klein";
}

interface CsvRow {
  stadt: string;
  type: string; // "Stadt" | "Landkreis"
  land: string;
  kontakt: string;
  size: SizeCategory;
}


export default function Statistics() {
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [blStats, setBlStats] = useState<Record<string, BundeslandStats>>({});
  const [sizeStats, setSizeStats] = useState<Record<SizeCategory, SizeStats>>({} as Record<SizeCategory, SizeStats>);
  const [leadStatusCounts, setLeadStatusCounts] = useState<Record<string, number>>({});
  const [leadsByLand, setLeadsByLand] = useState<Record<string, number>>({});
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [selectedLand, setSelectedLand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("auslaenderbehoerden").select("id, stadt, typ, land, kontakt, einwohner").then(({ data }) => {
      if (!data) return;
      const acc: Record<string, BundeslandStats> = {};
      const szAcc = {} as Record<SizeCategory, SizeStats>;
      const csvR: CsvRow[] = [];
      data.forEach(entry => {
        const land = entry.land?.trim();
        if (!land) return;
        const kontakt = entry.kontakt?.trim() ?? "";
        const size = getCitySize(entry.einwohner ?? "");
        csvR.push({ stadt: entry.stadt ?? "", type: entry.typ ?? "", land, kontakt, size });
        if (!acc[land]) acc[land] = { total: 0, contacted: 0 };
        acc[land].total++;
        if (!szAcc[size]) szAcc[size] = { total: 0, contacted: 0 };
        szAcc[size].total++;
        if (kontaktiertSet.has(kontakt.toUpperCase())) {
          acc[land].contacted++;
          szAcc[size].contacted++;
        }
      });
      setCsvRows(csvR);
      setBlStats(acc);
      setSizeStats(szAcc);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    supabase.from("leads").select("status, land").then(({ data }) => {
      if (data) {
        const counts: Record<string, number> = {};
        const byLand: Record<string, number> = {};
        data.forEach((r: { status: string; land: string | null }) => {
          counts[r.status] = (counts[r.status] ?? 0) + 1;
          if (r.land) byLand[r.land] = (byLand[r.land] ?? 0) + 1;
        });
        setLeadStatusCounts(counts);
        setLeadsByLand(byLand);
      }
      setLoadingLeads(false);
    });
  }, []);

  function handleLandClick(name: string) {
    setSelectedLand(name);
    setHoveredFeature(null);
  }

  const totalContacts = Object.values(blStats).reduce((a, s) => a + s.total, 0);
  const totalLeads    = Object.values(leadStatusCounts).reduce((a, b) => a + b, 0);
  const sortedStates  = Object.entries(blStats).sort((a, b) => b[1].total - a[1].total);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Statistik</h1>
          <p className="text-sm text-[color:var(--muted)]">Auswertungen und Übersichten der Kontaktdaten.</p>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Gesamt ABHs"    value={loading      ? "—" : totalContacts.toString()} />
          <StatCard label="Bundesländer"   value={loading      ? "—" : Object.keys(blStats).length.toString()} />
          <StatCard label="Leads gesamt"   value={loadingLeads ? "—" : totalLeads.toString()} />
          <StatCard label="In Bearbeitung" value={loadingLeads ? "—" : ((leadStatusCounts["kontaktiert"] ?? 0) + (leadStatusCounts["antwort"] ?? 0)).toString()} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── Map panel ── */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-center gap-2 min-h-[28px]">
              <p className="text-sm font-semibold text-[color:var(--muted-strong)]">
                {selectedLand ?? "Verteilung nach Bundesland"}
              </p>
            </div>

            {/* Map canvas */}
            <div className="relative flex-1 overflow-hidden rounded-lg" style={{ minHeight: 340 }}>
              <StatisticsLeafletMap
                blStats={blStats}
                leadsByLand={leadsByLand}
                csvRows={csvRows}
                selectedLand={selectedLand}
                onLandClick={handleLandClick}
                onBack={() => { setSelectedLand(null); setHoveredFeature(null); }}
              />
            </div>

            {/* Legend */}
            {!selectedLand && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[color:var(--muted)]">Wenig</span>
                  <div className="h-2 flex-1 rounded-full" style={{ background: "linear-gradient(to right,rgba(14,165,233,0.15),rgba(14,165,233,0.80))" }} />
                  <span className="text-xs text-[color:var(--muted)]">Viel</span>
                </div>
                <p className="text-center text-xs text-[color:var(--muted)]">Klicken zum Vergrößern · Hover für Details</p>
              </>
            )}
            {selectedLand && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  <LegendDot color="rgba(14,165,233,0.70)"  label="Landkreis – kontaktiert" />
                  <LegendDot color="rgba(14,165,233,0.26)"  label="Landkreis – offen" />
                  <LegendDot color="rgba(139,92,246,0.70)"  label="Kreisfreie Stadt – kontaktiert" />
                  <LegendDot color="rgba(139,92,246,0.26)"  label="Kreisfreie Stadt – offen" />
                  <LegendDot color="rgba(148,163,184,0.35)" label="Keine Daten" />
                </div>
                <p className="text-xs text-[color:var(--muted)]">Hover für Details</p>
              </div>
            )}
          </div>

          {/* Stats table */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--border)]">
              <p className="text-sm font-semibold text-[color:var(--muted-strong)]">Nach Bundesland</p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-[color:var(--surface-muted)] text-xs uppercase tracking-wide text-[color:var(--muted)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold border-b border-[color:var(--border)]">Bundesland</th>
                    <th className="px-4 py-2 text-right font-semibold border-b border-[color:var(--border)]">ABHs</th>
                    <th className="px-4 py-2 text-right font-semibold border-b border-[color:var(--border)]">Leads</th>
                    <th className="px-4 py-2 text-right font-semibold border-b border-[color:var(--border)]" title="Leads ÷ ABHs">Abdeckung</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? <tr><td colSpan={4} className="px-4 py-8 text-center text-[color:var(--muted)] text-sm">Lade Daten…</td></tr>
                    : sortedStates.map(([name, s]) => (
                      <tr
                        key={name}
                        className="border-b border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-hover)]"
                        style={!selectedLand && hoveredFeature === name ? { backgroundColor: "var(--surface-hover)" } : undefined}
                        onMouseEnter={() => !selectedLand && setHoveredFeature(name)}
                        onMouseLeave={() => setHoveredFeature(null)}
                      >
                        <td className="px-4 py-2 font-medium">{name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{s.total}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {leadsByLand[name] ? (
                            <span className="font-medium text-violet-600 dark:text-violet-400">{leadsByLand[name]}</span>
                          ) : <span className="text-[color:var(--muted)]">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[color:var(--muted)]">
                          {s.total && leadsByLand[name] ? Math.round((leadsByLand[name] / s.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Outreach Status Breakdown */}
        {!loadingLeads && totalLeads > 0 && (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-[color:var(--muted-strong)]">Outreach nach Status</p>
            <div className="flex flex-col gap-3">
              {LEAD_STATUS_ORDER.filter(s => (leadStatusCounts[s] ?? 0) > 0).map(status => {
                const count = leadStatusCounts[status]!;
                const pct = count / totalLeads;
                const color = LEAD_STATUS_COLORS[status];
                const labels: Record<string, string> = {
                  neu: "Neu", kontaktiert: "Kontaktiert", antwort: "Antwort erhalten",
                  abgeschlossen: "Abgeschlossen", abgelehnt: "Abgelehnt",
                };
                return (
                  <div key={status} className="grid grid-cols-[140px_1fr_56px] items-center gap-3 sm:grid-cols-[180px_1fr_72px]">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">{labels[status]}</span>
                    <div className="relative h-6 w-full overflow-hidden rounded-md bg-[color:var(--surface-muted)]">
                      <div className="absolute inset-y-0 left-0 rounded-md transition-all" style={{ width: `${pct * 100}%`, backgroundColor: color, opacity: 0.8 }} />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs font-semibold" style={{ color }}>{count}</span>
                      </div>
                    </div>
                    <span className="text-right text-sm tabular-nums text-[color:var(--muted)]">{Math.round(pct * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* City-size breakdown */}
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-[color:var(--muted-strong)]">Stadtgrößen</p>
          {loading ? (
            <p className="text-sm text-[color:var(--muted)]">Lade Daten…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {SIZE_ORDER.map(cat => {
                const s = sizeStats[cat];
                const total = s?.total ?? 0;
                const contacted = s?.contacted ?? 0;
                const grandTotal = Object.values(sizeStats).reduce((a, x) => a + x.total, 0) || 1;
                const pctOfAll = total / grandTotal;
                const pctContacted = total > 0 ? contacted / total : 0;
                const meta = SIZE_META[cat];
                return (
                  <div key={cat} className="grid grid-cols-[140px_1fr_56px] items-center gap-3 sm:grid-cols-[180px_1fr_72px]">
                    {/* Label */}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[color:var(--foreground)]">{meta.label}</span>
                      <span className="text-xs text-[color:var(--muted)]">{meta.sub}</span>
                    </div>

                    {/* Stacked bar: contacted (solid) + not contacted (faded) + empty */}
                    <div className="relative h-6 w-full overflow-hidden rounded-md bg-[color:var(--surface-muted)]">
                      {/* total slice */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-md"
                        style={{ width: `${pctOfAll * 100}%`, backgroundColor: meta.color, opacity: 0.22 }}
                      />
                      {/* contacted slice */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-md"
                        style={{ width: `${pctOfAll * pctContacted * 100}%`, backgroundColor: meta.color, opacity: 0.85 }}
                      />
                      {/* count labels */}
                      <div className="absolute inset-0 flex items-center px-2 gap-1.5">
                        <span className="text-xs font-semibold" style={{ color: meta.color }}>
                          {total}
                        </span>
                        {contacted > 0 && (
                          <span className="text-xs text-[color:var(--muted)]">
                            · {contacted} kontaktiert
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Percentage of total */}
                    <span className="text-right text-sm tabular-nums text-[color:var(--muted)]">
                      {Math.round(pctOfAll * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 flex-shrink-0 rounded-full border border-[color:var(--border)]" style={{ background: color }} />
      <span className="text-xs text-[color:var(--muted)]">{label}</span>
    </div>
  );
}
