"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, type Lead, type ABHEntry } from '@/lib/supabase';
import { parteiCls } from '@/lib/partei';
import { useDragScroll } from '@/lib/useDragScroll';
import { VERBINDLICHE_ZUSAGE, crmUrl } from '@/lib/crm';

const STATUS_OPTIONS = ['neu', 'kontaktiert', 'persönlicher kontakt', 'antwort', 'zusage', VERBINDLICHE_ZUSAGE, 'abgelehnt'];
const VON_OPTIONS = ['Ramin Goo', 'Jan Kortmann', 'Isabel Magallanes', 'Barbara Stasiak'];

const statusClass: Record<string, string> = {
  neu:                    'bg-blue-50    text-blue-700    border-blue-200    dark:bg-blue-950/40    dark:text-blue-300    dark:border-blue-800',
  kontaktiert:            'bg-violet-50  text-violet-700  border-violet-200  dark:bg-violet-950/40  dark:text-violet-300  dark:border-violet-800',
  'persönlicher kontakt': 'bg-orange-50  text-orange-700  border-orange-200  dark:bg-orange-950/40  dark:text-orange-300  dark:border-orange-800',
  antwort:                'bg-sky-50     text-sky-700     border-sky-200     dark:bg-sky-950/40     dark:text-sky-300     dark:border-sky-800',
  zusage:                 'bg-green-50   text-green-700   border-green-200   dark:bg-green-950/40   dark:text-green-300   dark:border-green-800',
  [VERBINDLICHE_ZUSAGE]:  'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50  dark:text-emerald-300 dark:border-emerald-700',
  abgelehnt:              'bg-red-50     text-red-700     border-red-200     dark:bg-red-950/40     dark:text-red-300     dark:border-red-800',
};

function rowStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'kontaktiert':            return { borderLeft: '3px solid #7c3aed' };
    case 'persönlicher kontakt':   return { borderLeft: '3px solid #ea580c' };
    case 'antwort':                return { borderLeft: '3px solid #0284c7' };
    case 'zusage':                 return { borderLeft: '3px solid #16a34a' };
    case VERBINDLICHE_ZUSAGE:      return { borderLeft: '3px solid #059669' };
    case 'abgelehnt':              return { borderLeft: '3px solid #dc2626' };
    default:                       return {};
  }
}

const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`;
const chevronStyle = { backgroundImage: chevronBg, backgroundRepeat: 'no-repeat' as const, backgroundPosition: 'right 6px center' };

function StatusBadge({ status, id, onChange }: { status: string; id: number; onChange: (id: number, val: string) => void }) {
  const cls = statusClass[status] ?? 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <select value={status} onChange={e => onChange(id, e.target.value)}
      className={`table-button border cursor-pointer appearance-none pr-5 ${cls}`} style={chevronStyle}>
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function VonSelect({ von, id, onChange }: { von: string | null; id: number; onChange: (id: number, val: string | null) => void }) {
  const assigned = !!von;
  return (
    <select value={von ?? ''} onChange={e => onChange(id, e.target.value || null)}
      className={`table-button border cursor-pointer appearance-none pr-5 transition-colors ${
        assigned
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
          : 'bg-[color:var(--surface-muted)] text-[color:var(--muted)] border-[color:var(--border)]'
      }`} style={chevronStyle}>
      <option value="">Nicht zugewiesen</option>
      {VON_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

type SortField = 'name' | 'stadt' | 'land' | 'partei' | 'status' | 'von' | 'created_at';

const BUNDESLAENDER = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
  'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
  'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-9 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";
const selectCls = inputCls + " appearance-none pr-9";

function SelectArrow() {
  return <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function EditLeadModal({ lead, abh, onSave, onCancel }: {
  lead: Lead;
  abh: ABHEntry | null;
  onSave: (leadPatch: Partial<Lead>, abhPatch?: Partial<ABHEntry>) => void;
  onCancel: () => void;
}) {
  // Lead fields (also synced to ABH where they overlap)
  const [name, setName]               = useState(lead.name);
  const [stadt, setStadt]             = useState(lead.stadt ?? '');
  const [land, setLand]               = useState(lead.land ?? '');
  const [buergermeister, setBuerger]  = useState(lead.buergermeister ?? '');
  const [partei, setPartei]           = useState(lead.partei ?? '');
  const [einwohner, setEinwohner]     = useState(lead.einwohner != null ? String(lead.einwohner) : '');
  const [von, setVon]                 = useState(lead.von ?? '');
  const [status, setStatus]           = useState(lead.status);
  const [crmId, setCrmId]             = useState(lead.crm_id ?? '');
  const [gdpr, setGdpr]               = useState(lead.gdpr_consent);
  const [notes, setNotes]             = useState(lead.notes ?? '');
  const [emails, setEmails]           = useState<string[]>(
    lead.kontaktdaten ? lead.kontaktdaten.split(/[;,]/).map(s => s.trim()).filter(Boolean) : ['']
  );

  // ABH-only fields
  const [typ, setTyp]         = useState(abh?.typ      ?? '');
  const [telefon, setTelefon] = useState(abh?.telefon  ?? '');
  const [website, setWebsite] = useState(abh?.website  ?? '');
  const [adresse, setAdresse] = useState(abh?.adresse  ?? '');

  function setEmail(i: number, val: string) { setEmails(prev => prev.map((e, j) => j === i ? val : e)); }
  function addEmail() { setEmails(prev => [...prev, '']); }
  function removeEmail(i: number) { setEmails(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : ['']); }

  const crmRequired = status === VERBINDLICHE_ZUSAGE;
  const crmMissing  = crmRequired && !crmId.trim();

  function handleSave() {
    if (crmMissing) return;
    const ewnNum  = einwohner.trim() ? parseInt(einwohner.replace(/\D/g, ''), 10) : null;
    const emailStr = emails.filter(Boolean).join('; ') || null;
    const trimName = name.trim() || lead.name;

    const leadPatch: Partial<Lead> = {
      name:           trimName,
      stadt:          stadt.trim()         || null,
      land:           land                 || null,
      buergermeister: buergermeister.trim() || null,
      partei:         partei.trim()        || null,
      einwohner:      isNaN(ewnNum as number) ? null : ewnNum,
      von:            von                  || null,
      status,
      crm_id:         crmId.trim()         || null,
      gdpr_consent:   gdpr,
      notes:          notes.trim()         || null,
      kontaktdaten:   emailStr,
    };

    // Cascade shared + ABH-only fields back to auslaenderbehoerden
    const abhPatch: Partial<ABHEntry> = {
      name:           trimName,
      stadt:          (stadt.trim() || null) as ABHEntry['stadt'],  // column is nullable; ABHEntry types it as string
      land:           land                 || null,
      buergermeister: buergermeister.trim() || null,
      partei:         partei.trim()        || null,
      kontaktdaten:   emailStr,
      einwohner:      einwohner.trim()     || null,  // ABH stores as string
      typ:            typ                  || null,
      telefon:        telefon.trim()       || null,
      website:        website.trim()       || null,
      adresse:        adresse.trim()       || null,
    };

    onSave(leadPatch, abh ? abhPatch : undefined);
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="animate-scale-in relative flex w-full max-w-lg flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[color:var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Lead bearbeiten</h2>
          {!abh && (
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              Kein ABH-Eintrag verknüpft — Änderungen werden nur im Outreach gespeichert
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5">

          {/* Stammdaten (synced to ABH) */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">Stammdaten</p>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Name">
                <input autoFocus value={name} onChange={e => setName(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Stadt">
              <input value={stadt} onChange={e => setStadt(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Bundesland">
              <div className="relative">
                <select value={land} onChange={e => setLand(e.target.value)} className={selectCls}>
                  <option value="">—</option>
                  {BUNDESLAENDER.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <SelectArrow />
              </div>
            </Field>
            <Field label="Bürgermeister/in">
              <input value={buergermeister} onChange={e => setBuerger(e.target.value)} placeholder="Name" className={inputCls} />
            </Field>
            <Field label="Partei">
              <input value={partei} onChange={e => setPartei(e.target.value)} placeholder="z.B. SPD" className={inputCls} />
            </Field>
            <div className="col-span-2">
              <Field label="Einwohner">
                <input type="number" min="0" value={einwohner} onChange={e => setEinwohner(e.target.value)} placeholder="z.B. 25000" className={inputCls} />
              </Field>
            </div>
          </div>

          {/* ABH-spezifisch */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">ABH-Daten</p>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <Field label="Typ">
              <div className="relative">
                <select value={typ} onChange={e => setTyp(e.target.value)} className={selectCls}
                  disabled={!abh} title={!abh ? 'Kein ABH-Eintrag verknüpft' : undefined}>
                  <option value="">—</option>
                  <option value="Stadt">Stadt</option>
                  <option value="Landkreis">Landkreis</option>
                </select>
                <SelectArrow />
              </div>
            </Field>
            <Field label="Telefon">
              <input value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="0123 456789" className={inputCls}
                disabled={!abh} />
            </Field>
            <div className="col-span-2">
              <Field label="Website">
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" className={inputCls}
                  disabled={!abh} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Adresse">
                <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Musterstraße 1, 12345 Stadt" className={inputCls}
                  disabled={!abh} />
              </Field>
            </div>
          </div>

          {/* Outreach */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">Outreach</p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zuständig">
                <div className="relative">
                  <select value={von} onChange={e => setVon(e.target.value)} className={selectCls}>
                    <option value="">Nicht zugewiesen</option>
                    {VON_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <SelectArrow />
                </div>
              </Field>
              <Field label="Status">
                <div className="relative">
                  <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <SelectArrow />
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={crmRequired ? 'CRM-ID *' : 'CRM-ID'}>
                <input
                  value={crmId}
                  onChange={e => setCrmId(e.target.value)}
                  placeholder="z.B. 20123"
                  className={`${inputCls} ${crmMissing ? 'border-red-400 focus-visible:ring-red-400 dark:border-red-500' : ''}`}
                />
                {crmMissing && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Für „{VERBINDLICHE_ZUSAGE}" ist eine CRM-ID erforderlich.</p>
                )}
                {!crmMissing && crmId.trim() && (
                  <a href={crmUrl(crmId)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs hover:underline">
                    Im CRM öffnen
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M3 1h6v6M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </a>
                )}
              </Field>
              <Field label="DSGVO-Einwilligung">
                <div className="flex h-9 items-center">
                  <button
                    type="button"
                    onClick={() => setGdpr(g => !g)}
                    className={`table-button border font-medium transition-colors ${gdpr ? 'yes-sc' : 'no-sc'}`}
                  >
                    {gdpr ? 'Ja' : 'Nein'}
                  </button>
                </div>
              </Field>
            </div>

            <Field label="E-Mail-Adressen">
              <div className="flex flex-col gap-2">
                {emails.map((email, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="email" value={email} onChange={e => setEmail(i, e.target.value)} placeholder="email@beispiel.de"
                      className="h-9 flex-1 rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 font-mono text-xs text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" />
                    <button type="button" onClick={() => removeEmail(i)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--border)] text-[color:var(--muted)] hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addEmail} className="inline-flex w-fit items-center gap-1 rounded-md border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] transition-colors">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Hinzufügen
                </button>
              </div>
            </Field>

            <Field label="Anmerkungen">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optionale Notizen…" rows={3}
                className="w-full resize-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-2 border-t border-[color:var(--border)] px-6 py-4">
          <button onClick={onCancel} className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={crmMissing} title={crmMissing ? 'CRM-ID erforderlich' : undefined} className="h-9 rounded-md bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80 disabled:opacity-40 disabled:hover:opacity-40">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-flex flex-col leading-none" aria-hidden="true">
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className={active && dir === 'asc' ? 'text-[color:var(--foreground)]' : 'text-[color:var(--muted)] opacity-40'}>
        <path d="M4 0L7.46 4.5H0.54L4 0Z" fill="currentColor" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className={active && dir === 'desc' ? 'text-[color:var(--foreground)]' : 'text-[color:var(--muted)] opacity-40'}>
        <path d="M4 5L0.54 0.5H7.46L4 5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function CrmIdModal({ lead, onConfirm, onCancel }: {
  lead: Lead;
  onConfirm: (crmId: string) => void;
  onCancel: () => void;
}) {
  const [crmId, setCrmId] = useState(lead.crm_id ?? '');
  const valid = crmId.trim().length > 0;

  function submit() { if (valid) onConfirm(crmId.trim()); }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="animate-scale-in relative w-full max-w-sm rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`table-button border ${statusClass[VERBINDLICHE_ZUSAGE]}`}>{VERBINDLICHE_ZUSAGE}</span>
        </div>
        <h2 className="mt-2 text-base font-semibold text-[color:var(--foreground)]">CRM-ID erforderlich</h2>
        <p className="mb-4 mt-0.5 text-sm text-[color:var(--muted)] line-clamp-1">{lead.name}</p>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">CRM-ID</label>
        <input
          autoFocus
          value={crmId}
          onChange={e => setCrmId(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="z.B. 20123"
          className="h-10 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        />
        {valid && (
          <p className="mt-2 break-all font-mono text-xs text-[color:var(--muted)]">{crmUrl(crmId)}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">
            Abbrechen
          </button>
          <button onClick={submit} disabled={!valid} className="h-9 rounded-md bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80 disabled:opacity-40 disabled:hover:opacity-40">
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

type ViewMode = 'list' | 'kanban';

export default function OutreachPage() {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [abhMap, setAbhMap]       = useState<Map<string, ABHEntry>>(new Map());
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const dragScroll                = useDragScroll();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId]           = useState<number | null>(null);
  const [editLeadId, setEditLeadId]           = useState<number | null>(null);
  const [crmPromptId, setCrmPromptId]         = useState<number | null>(null);
  const [search, setSearch]       = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [kanbanGroup, setKanbanGroup] = useState<'status' | 'person'>('status');

  useEffect(() => { fetchLeads(); }, []);

  async function fetchLeads() {
    setLoading(true);
    // Fetch leads + all ABH entries in parallel so the edit modal has full ABH data
    const [leadsRes, abhRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('auslaenderbehoerden').select('*'),
    ]);
    if (leadsRes.error) setError(leadsRes.error.message);
    else setLeads(leadsRes.data ?? []);
    if (abhRes.data) setAbhMap(new Map(abhRes.data.map(a => [a.name, a])));
    setLoading(false);
  }

  async function updateStatus(id: number, status: string) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    await supabase.from('leads').update({ status }).eq('id', id);
  }

  /** Status changes go through here so "verbindliche Zusage" can require a CRM ID first. */
  function handleStatusChange(id: number, status: string) {
    if (status === VERBINDLICHE_ZUSAGE) {
      const lead = leads.find(l => l.id === id);
      if (!lead?.crm_id) { setCrmPromptId(id); return; }
    }
    updateStatus(id, status);
  }

  async function confirmCrmStatus(id: number, crmId: string) {
    const patch = { status: VERBINDLICHE_ZUSAGE, crm_id: crmId };
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    setCrmPromptId(null);
    await supabase.from('leads').update(patch).eq('id', id);
  }

  async function updateGdprConsent(id: number, gdpr_consent: boolean) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, gdpr_consent } : l));
    await supabase.from('leads').update({ gdpr_consent }).eq('id', id);
  }

  async function updateVon(id: number, von: string | null) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, von } : l));
    await supabase.from('leads').update({ von }).eq('id', id);
  }

  async function updateFollowUp(id: number, follow_up: boolean) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, follow_up } : l));
    await supabase.from('leads').update({ follow_up }).eq('id', id);
  }

  async function updateLead(id: number, patch: Partial<Lead>, abhPatch?: Partial<ABHEntry>) {
    const original = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    const { error } = await supabase.from('leads').update(patch).eq('id', id);
    if (error) {
      if (original) setLeads(prev => prev.map(l => l.id === id ? original : l));
      setError(`Speichern fehlgeschlagen: ${error.message}`);
      return;
    }
    // Cascade to the linked ABH entry
    if (abhPatch && original) {
      const abh = abhMap.get(original.name);
      if (abh) {
        await supabase.from('auslaenderbehoerden').update(abhPatch).eq('id', abh.id);
        const newName = (abhPatch.name ?? abh.name) as string;
        setAbhMap(prev => {
          const next = new Map(prev);
          next.delete(original.name);
          next.set(newName, { ...abh, ...abhPatch });
          return next;
        });
      }
    }
  }

  async function deleteLead(id: number) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    await supabase.from('leads').delete().eq('id', id);
    setLeads(prev => prev.filter(l => l.id !== id));
    setDeletingId(null);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        [l.name, l.stadt, l.land, l.partei, l.kontaktdaten, l.status, l.von, l.notes, l.crm_id]
          .some(v => v && v.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      const aVal = (a[sortField] ?? '') as string;
      const bVal = (b[sortField] ?? '') as string;
      const cmp = aVal.localeCompare(bVal, 'de', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [leads, search, sortField, sortDir]);

  const byStatus = STATUS_OPTIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (search ? filteredLeads : leads).filter(l => l.status === s).length;
    return acc;
  }, {});

  const byVon = VON_OPTIONS.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (search ? filteredLeads : leads).filter(l => l.von === v).length;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
            <p className="text-sm text-[color:var(--muted)]">
              {leads.length} Lead{leads.length !== 1 ? 's' : ''} gespeichert
              {search && filteredLeads.length !== leads.length && (
                <span className="ml-1">· {filteredLeads.length} angezeigt</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
          {/* Kanban group toggle */}
          {viewMode === 'kanban' && (
            <div className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-1">
              <button
                onClick={() => setKanbanGroup('status')}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${kanbanGroup === 'status' ? 'bg-[color:var(--surface)] shadow-sm text-[color:var(--foreground)]' : 'text-[color:var(--muted)] hover:text-[color:var(--foreground)]'}`}
              >
                Status
              </button>
              <button
                onClick={() => setKanbanGroup('person')}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${kanbanGroup === 'person' ? 'bg-[color:var(--surface)] shadow-sm text-[color:var(--foreground)]' : 'text-[color:var(--muted)] hover:text-[color:var(--foreground)]'}`}
              >
                Person
              </button>
            </div>
          )}
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-1">
            <button
              onClick={() => setViewMode('list')}
              title="Listenansicht"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${viewMode === 'list' ? 'bg-[color:var(--surface)] shadow-sm text-[color:var(--foreground)]' : 'text-[color:var(--muted)] hover:text-[color:var(--foreground)]'}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban-Ansicht"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-[color:var(--surface)] shadow-sm text-[color:var(--foreground)]' : 'text-[color:var(--muted)] hover:text-[color:var(--foreground)]'}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="3.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="5.25" y="1" width="3.5" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="9.5" y="1" width="3.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
          </div>
          <a
            href="/outreach/email"
            className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] shadow-sm transition-colors hover:bg-[color:var(--surface-muted)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M1 5.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            E-Mail Vorlage
          </a>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]">
            {error}
          </div>
        )}

        {/* Search */}
        {!loading && leads.length > 0 && (
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Suche nach Name, Stadt, Partei, Status, Zuständig…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-10 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-9 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
          </section>
        )}

        {loading ? (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-6 text-sm text-[color:var(--muted-strong)] shadow-sm">
            Lade Leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-[color:var(--foreground)]">Noch keine Leads</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Füge Leads über die Übersicht hinzu.</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-[color:var(--foreground)]">Keine Ergebnisse für „{search}"</p>
            <button onClick={() => setSearch('')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">
              Suche zurücksetzen
            </button>
          </div>
        ) : viewMode === 'kanban' ? (
          /* ── Kanban view ── */
          (() => {
            const groups = kanbanGroup === 'status'
              ? STATUS_OPTIONS.map(key => ({ key, label: key, cards: filteredLeads.filter(l => l.status === key) }))
              : [...VON_OPTIONS.map(key => ({ key, label: key, cards: filteredLeads.filter(l => l.von === key) })),
                 { key: '__unassigned__', label: 'Nicht zugewiesen', cards: filteredLeads.filter(l => !l.von) }];

            const KanbanCard = ({ lead }: { lead: Lead }) => (
              <div
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-sm hover:shadow-md transition-shadow"
                style={rowStyle(lead.status)}
              >
                <div className="mb-2 flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold leading-snug text-[color:var(--foreground)] line-clamp-2">{lead.name}</span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => setEditLeadId(lead.id)} className="flex h-6 w-6 items-center justify-center rounded text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] transition-colors">
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {confirmDeleteId === lead.id ? (
                      <>
                        <button onClick={() => deleteLead(lead.id)} disabled={deletingId === lead.id} className="h-6 rounded bg-red-500 px-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors">✓</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="flex h-6 w-6 items-center justify-center rounded text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] transition-colors">✕</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(lead.id)} className="flex h-6 w-6 items-center justify-center rounded text-[color:var(--muted)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger-fg)] transition-colors">
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs text-[color:var(--muted)]">
                  {lead.stadt && <span>{lead.stadt}{lead.land ? ` · ${lead.land}` : ''}</span>}
                  {lead.kontaktdaten && (
                    <a href={`mailto:${lead.kontaktdaten.split(/[;,]/)[0].trim()}`} className="truncate font-mono hover:underline">
                      {lead.kontaktdaten.split(/[;,]/)[0].trim()}
                    </a>
                  )}
                  {lead.notes && <p className="line-clamp-2">{lead.notes}</p>}
                  {lead.crm_id && (
                    <a href={crmUrl(lead.crm_id)} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 font-mono hover:underline">
                      CRM #{lead.crm_id}
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M3 1h6v6M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                  )}
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  {/* Status badge — always shown */}
                  <select
                    value={lead.status}
                    onChange={e => handleStatusChange(lead.id, e.target.value)}
                    className={`table-button border cursor-pointer appearance-none pr-5 text-xs ${statusClass[lead.status] ?? ''}`}
                    style={chevronStyle}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {/* Person initials — shown when grouping by status */}
                  {kanbanGroup === 'status' && lead.von && (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" title={lead.von}>
                      {lead.von.split(' ').map((w: string) => w[0]).join('')}
                    </span>
                  )}
                  {/* Von select — shown when grouping by person */}
                  {kanbanGroup === 'person' && (
                    <VonSelect von={lead.von} id={lead.id} onChange={updateVon} />
                  )}
                </div>
              </div>
            );

            return (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-3" style={{ minWidth: `${groups.length * 260}px` }}>
                  {groups.map(({ key, label, cards }) => {
                    const colCls = kanbanGroup === 'status'
                      ? (statusClass[key] ?? 'bg-gray-50 text-gray-600 border-gray-200')
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
                    return (
                      <div key={key} className="flex w-60 shrink-0 flex-col gap-2">
                        <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${colCls}`}>
                          <span className="text-xs font-semibold capitalize">{label}</span>
                          <span className="text-xs font-semibold opacity-70">{cards.length}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {cards.map(lead => <KanbanCard key={lead.id} lead={lead} />)}
                          {cards.length === 0 && (
                            <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-6 text-center text-xs text-[color:var(--muted)]">
                              Keine Leads
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
            <div ref={dragScroll.ref} className="overflow-x-auto cursor-grab"
              onMouseDown={dragScroll.onMouseDown} onMouseMove={dragScroll.onMouseMove}
              onMouseUp={dragScroll.onMouseUp} onMouseLeave={dragScroll.onMouseLeave}>
              <table className="w-full border-collapse text-sm text-[color:var(--muted-strong)]">
                <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--muted)]">
                  <tr className="bg-[color:var(--surface-muted)]">
                    {[
                      { label: 'Name', field: 'name' as SortField, width: 200 },
                      { label: 'Stadt', field: 'stadt' as SortField, width: 110 },
                      { label: 'Bundesland', field: 'land' as SortField, width: 130 },
                      { label: 'Partei', field: 'partei' as SortField, width: 90 },
                    ].map(({ label, field, width }) => (
                      <th key={field} onClick={() => handleSort(field)}
                        className="cursor-pointer select-none border-b border-[color:var(--border)] px-3 py-3 font-semibold hover:bg-[color:var(--surface-hover)] transition-colors"
                        style={{ minWidth: width }}>
                        <span className="inline-flex items-center">{label} <SortIcon active={sortField === field} dir={sortDir} /></span>
                      </th>
                    ))}
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 210 }}>E-Mail</th>
                    <th onClick={() => handleSort('von')} className="cursor-pointer select-none border-b border-[color:var(--border)] px-3 py-3 font-semibold hover:bg-[color:var(--surface-hover)] transition-colors" style={{ minWidth: 150 }}>
                      <span className="inline-flex items-center">Von <SortIcon active={sortField === 'von'} dir={sortDir} /></span>
                    </th>
                    <th onClick={() => handleSort('status')} className="cursor-pointer select-none border-b border-[color:var(--border)] px-3 py-3 font-semibold hover:bg-[color:var(--surface-hover)] transition-colors" style={{ minWidth: 130 }}>
                      <span className="inline-flex items-center">Status <SortIcon active={sortField === 'status'} dir={sortDir} /></span>
                    </th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 100 }}>CRM</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 90 }}>DSGVO</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 90 }}>Follow-up</th>
                    <th onClick={() => handleSort('created_at')} className="cursor-pointer select-none border-b border-[color:var(--border)] px-3 py-3 font-semibold hover:bg-[color:var(--surface-hover)] transition-colors" style={{ minWidth: 100 }}>
                      <span className="inline-flex items-center">Hinzugefügt <SortIcon active={sortField === 'created_at'} dir={sortDir} /></span>
                    </th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3 font-semibold" style={{ minWidth: 180 }}>Anmerkungen</th>
                    <th className="border-b border-[color:var(--border)] px-3 py-3" style={{ minWidth: 90 }} />
                  </tr>
                </thead>
                <tbody key={filteredLeads.map(l => l.id).join(',')}>
                  {filteredLeads.map((lead, i) => (
                    <tr key={lead.id} className="animate-row-in hover:bg-[color:var(--surface-hover)] transition-colors"
                      style={{ animationDelay: `${i * 20}ms`, ...rowStyle(lead.status) }}>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="line-clamp-2 font-medium leading-snug">{lead.name}</div>
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
                        {lead.kontaktdaten ? (
                          <div className="flex flex-col gap-0.5">
                            {lead.kontaktdaten.split(/[;,]/).map(e => e.trim()).filter(Boolean).map(email => (
                              <a key={email} href={`mailto:${email}`} className="whitespace-nowrap font-mono text-xs hover:underline">{email}</a>
                            ))}
                          </div>
                        ) : <span className="text-[color:var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <VonSelect von={lead.von} id={lead.id} onChange={updateVon} />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <StatusBadge status={lead.status} id={lead.id} onChange={handleStatusChange} />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {lead.crm_id ? (
                          <a href={crmUrl(lead.crm_id)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-xs hover:underline">
                            #{lead.crm_id}
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M3 1h6v6M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </a>
                        ) : <span className="text-[color:var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <button onClick={() => updateGdprConsent(lead.id, !lead.gdpr_consent)}
                          className={`table-button border font-medium transition-colors ${lead.gdpr_consent ? 'yes-sc' : 'no-sc'}`}>
                          {lead.gdpr_consent ? 'Ja' : 'Nein'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <button onClick={() => updateFollowUp(lead.id, !lead.follow_up)}
                          className={['table-button border font-medium transition-colors',
                            lead.follow_up
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-[color:var(--surface-muted)] text-[color:var(--muted)] border-[color:var(--border)]',
                          ].join(' ')}>
                          {lead.follow_up ? 'Ja' : 'Nein'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-xs tabular-nums text-[color:var(--muted)]">{formatDate(lead.created_at)}</span>
                      </td>
                      <td className="px-3 py-2.5 align-middle" style={{ maxWidth: 180 }}>
                        {lead.notes
                          ? <p className="line-clamp-2 text-xs leading-snug text-[color:var(--muted-strong)]">{lead.notes}</p>
                          : <span className="text-xs text-[color:var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {confirmDeleteId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteLead(lead.id)} disabled={deletingId === lead.id}
                              className="h-6 rounded-md bg-red-500 px-2 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                              Löschen
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="h-6 rounded-md border border-[color:var(--border)] px-2 text-xs text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] transition-colors">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditLeadId(lead.id)} aria-label="Lead bearbeiten"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]">
                              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button onClick={() => setConfirmDeleteId(lead.id)} aria-label="Lead entfernen"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger-fg)]">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary strip */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[color:var(--border)] px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <span key={s} className={`table-button border ${statusClass[s]}`}>{s}: {byStatus[s] ?? 0}</span>
                ))}
              </div>
              <div className="hidden h-4 w-px bg-[color:var(--border)] sm:block" />
              <div className="flex flex-wrap gap-2">
                {VON_OPTIONS.map(v => {
                  const count = byVon[v] ?? 0;
                  const initials = v.split(' ').map(w => w[0]).join('');
                  return (
                    <span key={v} title={v} className={`table-button border ${count > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' : 'bg-[color:var(--surface-muted)] text-[color:var(--muted)] border-[color:var(--border)]'}`}>
                      {initials}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      {editLeadId !== null && (() => {
        const lead = leads.find(l => l.id === editLeadId);
        if (!lead) return null;
        return (
          <EditLeadModal
            lead={lead}
            abh={abhMap.get(lead.name) ?? null}
            onSave={(patch, abhPatch) => { updateLead(editLeadId, patch, abhPatch); setEditLeadId(null); }}
            onCancel={() => setEditLeadId(null)}
          />
        );
      })()}

      {crmPromptId !== null && (() => {
        const lead = leads.find(l => l.id === crmPromptId);
        if (!lead) return null;
        return (
          <CrmIdModal
            lead={lead}
            onConfirm={crmId => confirmCrmStatus(crmPromptId, crmId)}
            onCancel={() => setCrmPromptId(null)}
          />
        );
      })()}
    </main>
  );
}
