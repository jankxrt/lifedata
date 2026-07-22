"use client";
import { useState, useEffect, ReactNode } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import type { ABHEntry } from '@/lib/supabase';
import { useDragScroll } from '@/lib/useDragScroll';
import { parteiCls } from '@/lib/partei';
import { VERBINDLICHE_ZUSAGE, crmUrl } from '@/lib/crm';

const VON_OPTIONS = ['Ramin Goo', 'Jan Kortmann', 'Isabel Magallanes', 'Barbara Stasiak'];
const LEAD_STATUS_OPTIONS = ['neu', 'kontaktiert', 'persönlicher kontakt', 'antwort', 'zusage', VERBINDLICHE_ZUSAGE, 'abgelehnt'];

function AddLeadModal({ name, onConfirm, onCancel }: {
  name: string;
  onConfirm: (von: string | null, notes: string, status: string, crmId: string | null) => void;
  onCancel: () => void;
}) {
  const [von, setVon] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('neu');
  const [crmId, setCrmId] = useState('');
  const crmRequired = status === VERBINDLICHE_ZUSAGE;
  const crmMissing  = crmRequired && !crmId.trim();
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="animate-scale-in relative w-full max-w-md rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="mb-0.5 text-base font-semibold text-[color:var(--foreground)]">Lead hinzufügen</h2>
        <p className="mb-5 text-sm text-[color:var(--muted)] line-clamp-1">{name}</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[color:var(--muted-strong)]">Zuständig</label>
            <div className="relative">
              <select value={von} onChange={e => setVon(e.target.value)} autoFocus className="h-10 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">
                <option value="">Nicht zugewiesen</option>
                {VON_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[color:var(--muted-strong)]">Status</label>
            <div className="relative">
              <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] capitalize">
                {LEAD_STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          {crmRequired && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[color:var(--muted-strong)]">CRM-ID *</label>
              <input value={crmId} onChange={e => setCrmId(e.target.value)} placeholder="z.B. 20123"
                className={`h-10 w-full rounded-md border bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${crmMissing ? 'border-red-400 focus-visible:ring-red-400 dark:border-red-500' : 'border-[color:var(--border-strong)]'}`} />
              {crmMissing
                ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">Für „{VERBINDLICHE_ZUSAGE}" ist eine CRM-ID erforderlich.</p>
                : <p className="mt-1 break-all font-mono text-xs text-[color:var(--muted)]">{crmUrl(crmId)}</p>}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[color:var(--muted-strong)]">Anmerkungen</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optionale Notizen zum Lead…" rows={3} className="w-full resize-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">Abbrechen</button>
          <button onClick={() => { if (!crmMissing) onConfirm(von || null, notes, status, crmId.trim() || null); }} disabled={crmMissing} className="h-9 rounded-md bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80 disabled:opacity-40 disabled:hover:opacity-80">Hinzufügen</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="animate-scale-in relative w-full max-w-sm rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-amber-500">
            <path d="M9 7h2v5H9V7Zm0 6h2v2H9v-2Z" fill="currentColor"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M10 1a9 9 0 1 0 0 18A9 9 0 0 0 10 1ZM3 10a7 7 0 1 1 14 0A7 7 0 0 1 3 10Z" fill="currentColor"/>
          </svg>
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Alle Einträge anzeigen?</h2>
        </div>
        <p className="mb-5 text-sm text-[color:var(--muted)]">
          Es werden alle <span className="font-medium text-[color:var(--foreground)]">{count}</span> Einträge auf einmal geladen. Bei großen Datensätzen kann dies zu Verzögerungen führen.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">Abbrechen</button>
          <button onClick={onConfirm} className="h-9 rounded-md bg-amber-500 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">Trotzdem anzeigen</button>
        </div>
      </div>
    </div>
  );
}

const getCitySizeCategory = (s: string | null): string => {
  if (!s || s.trim() === '' || s === '0') return 'N.N.';
  const n = parseInt(s.replace(/\D/g, ''), 10);
  if (isNaN(n)) return 'N.N.';
  if (n >= 1000000) return 'Millionenstadt';
  if (n >= 100000) return 'Groß';
  if (n >= 20000) return 'Mittel';
  return 'Klein';
};

const categoryClassMap: Record<string, string> = {
  'Klein': 'sm-sc', 'Mittel': 'md-sc', 'Groß': 'bg-sc', 'Millionenstadt': 'mil-sc', 'N.N.': 'nn-sc',
};

// partyClassMap removed — use shared parteiCls() from @/lib/partei instead

const leadStatusClass: Record<string, string> = {
  neu:                   'bg-blue-50   text-blue-700   border border-blue-200   dark:bg-blue-950/40  dark:text-blue-300  dark:border-blue-800',
  kontaktiert:           'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  'persönlicher kontakt':'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  antwort:               'bg-sky-50    text-sky-700    border border-sky-200    dark:bg-sky-950/40   dark:text-sky-300   dark:border-sky-800',
  zusage:                'bg-green-50  text-green-700  border border-green-200  dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
  [VERBINDLICHE_ZUSAGE]: 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
  abgelehnt:             'bg-red-50    text-red-700    border border-red-200    dark:bg-red-950/40   dark:text-red-300   dark:border-red-800',
};

const STATUS_ORDER: Record<string, number> = {
  neu: 0, kontaktiert: 1, 'persönlicher kontakt': 2, antwort: 3, zusage: 4, [VERBINDLICHE_ZUSAGE]: 5, abgeschlossen: 6, abgelehnt: 7,
};

type SortDir = 'asc' | 'desc';
type SortField = 'name' | 'stadt' | 'land' | 'einwohner' | 'partei' | 'buergermeister' | 'kontaktdaten' | 'telefon' | 'website' | 'adresse' | 'typ' | 'kontakt';

type ColDef = { key: SortField; label: string; width: string };
const COLUMNS: ColDef[] = [
  { key: 'name',           label: 'Name',               width: '200px' },
  { key: 'stadt',          label: 'Stadt',              width: '110px' },
  { key: 'kontaktdaten',   label: 'E-Mail',             width: '220px' },
  { key: 'typ',            label: 'Typ',                width: '80px'  },
  { key: 'land',           label: 'Land',               width: '110px' },
  { key: 'website',        label: 'Website',            width: '180px' },
  { key: 'telefon',        label: 'Telefon',            width: '130px' },
  { key: 'buergermeister', label: 'Bürgermeister/Landrat', width: '160px' },
  { key: 'adresse',        label: 'Adresse',            width: '180px' },
  { key: 'einwohner',      label: 'Größe',              width: '80px'  },
  { key: 'partei',         label: 'Partei',             width: '110px' },
];

function SortIcon({ col, sortCol, sortDir }: { col: SortField; sortCol: SortField | null; sortDir: SortDir }) {
  const active = sortCol === col;
  return (
    <span className="ml-1.5 inline-flex flex-col leading-none" aria-hidden="true">
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className={active && sortDir === 'asc' ? 'text-[color:var(--foreground)]' : 'text-[color:var(--muted)] opacity-40'}>
        <path d="M4 0L7.46 4.5H0.54L4 0Z" fill="currentColor" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className={active && sortDir === 'desc' ? 'text-[color:var(--foreground)]' : 'text-[color:var(--muted)] opacity-40'}>
        <path d="M4 5L0.54 0.5H7.46L4 5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

const BUNDESLAENDER = ['Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen'];

function AddABHModal({ onSave, onCancel }: { onSave: (fields: Record<string, string>) => Promise<void>; onCancel: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({ Name: '', Stadt: '', Land: '', Einwohner: '', Partei: '', Buergermeister: '', Adresse: '', Website: '', Telefon: '' });
  const [emails, setEmails] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setFields(f => ({ ...f, [k]: v }));
  const setEmail = (i: number, v: string) => setEmails(em => em.map((e, idx) => idx === i ? v : e));
  const addEmail = () => setEmails(em => [...em, '']);
  const removeEmail = (i: number) => setEmails(em => em.filter((_, idx) => idx !== i));

  async function handleSave() {
    if (!fields.Name.trim() || !fields.Stadt.trim()) return;
    setSaving(true);
    await onSave({ ...fields, Kontaktdaten: emails.filter(Boolean).join('; ') });
    setSaving(false);
  }

  const inputCls = "h-9 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";
  const labelCls = "mb-1 block text-xs font-medium text-[color:var(--muted-strong)]";

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="animate-scale-in relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-[color:var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">ABH hinzufügen</h2>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={labelCls}>Name *</label><input className={inputCls} value={fields.Name} onChange={e => set('Name', e.target.value)} autoFocus /></div>
            <div><label className={labelCls}>Stadt *</label><input className={inputCls} value={fields.Stadt} onChange={e => set('Stadt', e.target.value)} /></div>
            <div><label className={labelCls}>Bundesland</label>
              <div className="relative">
                <select className={inputCls + ' appearance-none pr-8'} value={fields.Land} onChange={e => set('Land', e.target.value)}>
                  <option value="">–</option>
                  {BUNDESLAENDER.map(bl => <option key={bl} value={bl}>{bl}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div><label className={labelCls}>Einwohner</label><input className={inputCls} value={fields.Einwohner} onChange={e => set('Einwohner', e.target.value)} placeholder="z.B. 50000" /></div>
            <div><label className={labelCls}>Partei</label><input className={inputCls} value={fields.Partei} onChange={e => set('Partei', e.target.value)} /></div>
            <div className="col-span-2"><label className={labelCls}>Bürgermeister/in</label><input className={inputCls} value={fields.Buergermeister} onChange={e => set('Buergermeister', e.target.value)} /></div>
            <div className="col-span-2"><label className={labelCls}>Adresse</label><input className={inputCls} value={fields.Adresse} onChange={e => set('Adresse', e.target.value)} /></div>
            <div><label className={labelCls}>Website</label><input className={inputCls} value={fields.Website} onChange={e => set('Website', e.target.value)} /></div>
            <div><label className={labelCls}>Telefon</label><input className={inputCls} value={fields.Telefon} onChange={e => set('Telefon', e.target.value)} /></div>
            <div className="col-span-2">
              <label className={labelCls}>E-Mail Adressen</label>
              <div className="flex flex-col gap-1.5">
                {emails.map((em, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input className={inputCls} value={em} onChange={e => setEmail(i, e.target.value)} placeholder="email@example.com" />
                    {emails.length > 1 && <button onClick={() => removeEmail(i)} className="h-9 w-9 shrink-0 rounded-md border border-[color:var(--border)] text-[color:var(--muted)] hover:text-red-600 transition-colors text-lg leading-none">–</button>}
                  </div>
                ))}
                <button onClick={addEmail} className="self-start text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors">+ E-Mail hinzufügen</button>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[color:var(--border)] px-6 py-4 flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !fields.Name.trim() || !fields.Stadt.trim()} className="h-9 rounded-md bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80 disabled:opacity-40">
            {saving ? 'Speichern…' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditABHModal({ entry, onSave, onCancel }: {
  entry: ABHEntry;
  onSave: (id: number, patch: Partial<ABHEntry>) => Promise<void>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    name:           entry.name,
    stadt:          entry.stadt,
    land:           entry.land           ?? '',
    einwohner:      entry.einwohner      ?? '',
    partei:         entry.partei         ?? '',
    buergermeister: entry.buergermeister ?? '',
    adresse:        entry.adresse        ?? '',
    website:        entry.website        ?? '',
    telefon:        entry.telefon        ?? '',
    typ:            entry.typ            ?? '',
  });
  const [emails, setEmails] = useState<string[]>(() => {
    const parts = (entry.kontaktdaten ?? '').split(/[;,]/).map(e => e.trim()).filter(Boolean);
    return parts.length ? parts : [''];
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setFields(f => ({ ...f, [k]: v }));
  const setEmail = (i: number, v: string) => setEmails(em => em.map((e, idx) => idx === i ? v : e));
  const addEmail = () => setEmails(em => [...em, '']);
  const removeEmail = (i: number) => setEmails(em => em.filter((_, idx) => idx !== i));

  async function handleSave() {
    setSaving(true);
    await onSave(entry.id, {
      ...fields,
      land:           fields.land           || null,
      einwohner:      fields.einwohner      || null,
      partei:         fields.partei         || null,
      buergermeister: fields.buergermeister || null,
      adresse:        fields.adresse        || null,
      website:        fields.website        || null,
      telefon:        fields.telefon        || null,
      typ:            fields.typ            || null,
      kontaktdaten:   emails.filter(Boolean).join('; ') || null,
    });
    setSaving(false);
  }

  const inputCls = "h-9 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";
  const labelCls = "mb-1 block text-xs font-medium text-[color:var(--muted-strong)]";

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="animate-scale-in relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-[color:var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Eintrag bearbeiten</h2>
          <p className="text-sm text-[color:var(--muted)]">{entry.stadt}</p>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={labelCls}>Name</label><input className={inputCls} value={fields.name} onChange={e => set('name', e.target.value)} autoFocus /></div>
            <div><label className={labelCls}>Stadt</label><input className={inputCls} value={fields.stadt} onChange={e => set('stadt', e.target.value)} /></div>
            <div><label className={labelCls}>Bundesland</label>
              <div className="relative">
                <select className={inputCls + ' appearance-none pr-8'} value={fields.land} onChange={e => set('land', e.target.value)}>
                  <option value="">–</option>
                  {BUNDESLAENDER.map(bl => <option key={bl} value={bl}>{bl}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div><label className={labelCls}>Einwohner</label><input className={inputCls} value={fields.einwohner} onChange={e => set('einwohner', e.target.value)} /></div>
            <div><label className={labelCls}>Partei</label><input className={inputCls} value={fields.partei} onChange={e => set('partei', e.target.value)} /></div>
            <div>
              <label className={labelCls}>Typ</label>
              <div className="relative">
                <select className={inputCls + ' appearance-none pr-8'} value={fields.typ} onChange={e => set('typ', e.target.value)}>
                  <option value="">–</option>
                  <option value="Stadt">Stadt</option>
                  <option value="Landkreis">Landkreis</option>
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div className="col-span-2"><label className={labelCls}>Bürgermeister/in</label><input className={inputCls} value={fields.buergermeister} onChange={e => set('buergermeister', e.target.value)} /></div>
            <div className="col-span-2"><label className={labelCls}>Adresse</label><input className={inputCls} value={fields.adresse} onChange={e => set('adresse', e.target.value)} /></div>
            <div><label className={labelCls}>Website</label><input className={inputCls} value={fields.website} onChange={e => set('website', e.target.value)} /></div>
            <div><label className={labelCls}>Telefon</label><input className={inputCls} value={fields.telefon} onChange={e => set('telefon', e.target.value)} /></div>
            <div className="col-span-2">
              <label className={labelCls}>E-Mail Adressen</label>
              <div className="flex flex-col gap-1.5">
                {emails.map((em, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input className={inputCls} value={em} onChange={e => setEmail(i, e.target.value)} placeholder="email@example.com" />
                    {emails.length > 1 && <button onClick={() => removeEmail(i)} className="h-9 w-9 shrink-0 rounded-md border border-[color:var(--border)] text-[color:var(--muted)] hover:text-red-600 transition-colors text-lg leading-none">–</button>}
                  </div>
                ))}
                <button onClick={addEmail} className="self-start text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors">+ E-Mail hinzufügen</button>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[color:var(--border)] px-6 py-4 flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">Abbrechen</button>
          <button onClick={handleSave} disabled={saving} className="h-9 rounded-md bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80 disabled:opacity-40">
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

function deriveTyp(name: string): 'Stadt' | 'Kreis' | 'N.N.' {
  if (name.includes('KRV')) return 'Kreis';
  if (name.includes('STV')) return 'Stadt';
  return 'N.N.';
}

export default function App() {
  const [entries, setEntries]   = useState<ABHEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [importing, setImporting] = useState(false);

  const [searchTerm, setSearchTerm]             = useState('');
  const [bundeslandFilter, setBundeslandFilter]  = useState('');
  const [parteiFilter, setParteiFilter]          = useState('');
  const [sizeFilter, setSizeFilter]              = useState('');
  const [hideLeads, setHideLeads]                = useState(false);
  const [excludedBundeslaender, setExcludedBundeslaender] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortCol, setSortCol]         = useState<SortField | null>(null);
  const [sortDir, setSortDir]         = useState<SortDir>('asc');
  const [showAllModal, setShowAllModal] = useState(false);

  const [leadStatus, setLeadStatus]         = useState<Map<string, string>>(new Map());
  const [addingLead, setAddingLead]         = useState<string | null>(null);
  const [pendingLeadEntry, setPendingLeadEntry] = useState<ABHEntry | null>(null);

  const [showAddABH, setShowAddABH]         = useState(false);
  const [editingEntry, setEditingEntry]     = useState<ABHEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('auslaenderbehoerden').select('*').order('name').then(({ data, error: err }) => {
      if (err) setError('Fehler beim Laden der Daten: ' + err.message);
      else if (data) setEntries(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    supabase.from('leads').select('name, status').then(({ data }) => {
      if (data) setLeadStatus(new Map(data.map((r: { name: string; status: string }) => [r.name, r.status])));
    });
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, bundeslandFilter, parteiFilter, excludedBundeslaender, sizeFilter, hideLeads]);
  useEffect(() => { setCurrentPage(1); }, [rowsPerPage, sortCol, sortDir]);

  async function importFromCSV() {
    setImporting(true);
    setError('');
    Papa.parse<string[]>('/data/abs_bundesland.csv', {
      download: true, skipEmptyLines: true, encoding: 'ISO-8859-1',
      complete: async ({ data }) => {
        if (data.length < 2) { setImporting(false); return; }
        const [headers, ...rows] = data;
        const idx = (name: string) => headers.findIndex((h: string) => h.trim() === name);
        const nameIdx = idx('Name'), stadtIdx = idx('Stadt'), landIdx = idx('Land');
        const ewnIdx = idx('Einwohner'), parteiIdx = idx('Partei'), buergerIdx = idx('Bürgermeister');
        const addrIdx = idx('Adresse'), telIdx = idx('Telefon'), webIdx = idx('Website');
        const kdIdx = idx('Kontaktdaten'), latIdx = idx('Lat'), lngIdx = idx('Lng');
        const faxIdx = idx('Fax'), typIdx = idx('Type'), kontaktIdx = idx('Kontakt');

        // Build a lookup map of existing entries by Stadt (lowercase) → id
        const { data: existing } = await supabase.from('auslaenderbehoerden').select('id, stadt');
        const existingByStadt = new Map<string, number>(
          (existing ?? []).map((e: { id: number; stadt: string }) => [e.stadt?.toLowerCase(), e.id])
        );

        const seen = new Set<string>();
        const toInsert: Omit<ABHEntry, 'id' | 'created_at'>[] = [];
        const toUpdate: { id: number; patch: Partial<ABHEntry> }[] = [];

        for (const row of rows) {
          const stadt = row[stadtIdx]?.trim();
          if (!stadt || seen.has(stadt.toLowerCase())) continue;
          seen.add(stadt.toLowerCase());
          const latStr = row[latIdx]?.trim();
          const lngStr = row[lngIdx]?.trim();
          const csvData = {
            name:           row[nameIdx]?.trim()    || '',
            stadt,
            land:           row[landIdx]?.trim()    || null,
            einwohner:      row[ewnIdx]?.trim()     || null,
            partei:         row[parteiIdx]?.trim()  || null,
            buergermeister: buergerIdx >= 0 ? row[buergerIdx]?.trim() || null : null,
            adresse:        row[addrIdx]?.trim()    || null,
            telefon:        row[telIdx]?.trim()     || null,
            website:        row[webIdx]?.trim()     || null,
            kontaktdaten:   row[kdIdx]?.trim()      || null,
            lat:            latStr ? parseFloat(latStr) || null : null,
            lng:            lngStr ? parseFloat(lngStr) || null : null,
            fax:     faxIdx >= 0     ? row[faxIdx]?.trim()     || null : null,
            typ:     typIdx >= 0     ? row[typIdx]?.trim()     || null : null,
            kontakt: kontaktIdx >= 0 ? row[kontaktIdx]?.trim() || null : null,
          };
          const existingId = existingByStadt.get(stadt.toLowerCase());
          if (existingId != null) {
            toUpdate.push({ id: existingId, patch: csvData });
          } else {
            toInsert.push(csvData);
          }
        }

        // Insert new rows in batches
        for (let i = 0; i < toInsert.length; i += 100) {
          const { error: insertErr } = await supabase.from('auslaenderbehoerden').insert(toInsert.slice(i, i + 100));
          if (insertErr) { setError('Import-Fehler: ' + insertErr.message); setImporting(false); return; }
        }
        // Update existing rows in batches
        for (let i = 0; i < toUpdate.length; i += 50) {
          const batch = toUpdate.slice(i, i + 50);
          for (const { id, patch } of batch) {
            await supabase.from('auslaenderbehoerden').update(patch).eq('id', id);
          }
        }

        const { data: fresh } = await supabase.from('auslaenderbehoerden').select('*').order('name');
        if (fresh) setEntries(fresh);
        setImporting(false);
      },
      error: () => { setError('CSV konnte nicht gelesen werden.'); setImporting(false); },
    });
  }

  async function addLead(entry: ABHEntry, von: string | null, notes: string, status = 'neu', crmId: string | null = null) {
    if (!entry.name || leadStatus.has(entry.name)) return;
    setAddingLead(entry.name);
    const einwStr = entry.einwohner?.replace(/\D/g, '');
    await supabase.from('leads').insert({
      name:          entry.name,
      stadt:         entry.stadt          || null,
      land:          entry.land           || null,
      buergermeister: entry.buergermeister || null,
      partei:        entry.partei         || null,
      kontaktdaten:  entry.kontaktdaten   || null,
      einwohner:     einwStr ? parseInt(einwStr, 10) : null,
      von,
      notes:         notes || null,
      status,
      crm_id:        crmId,
    });
    setLeadStatus(prev => new Map([...prev, [entry.name, status]]));
    setAddingLead(null);
  }

  async function saveABH(fields: Record<string, string>) {
    const { error: insertErr } = await supabase.from('auslaenderbehoerden').insert({
      name:          fields.Name,
      stadt:         fields.Stadt,
      land:          fields.Land           || null,
      einwohner:     fields.Einwohner      || null,
      partei:        fields.Partei         || null,
      buergermeister: fields.Buergermeister || null,
      adresse:       fields.Adresse        || null,
      website:       fields.Website        || null,
      telefon:       fields.Telefon        || null,
      kontaktdaten:  fields.Kontaktdaten   || null,
    });
    if (insertErr) { setError(`Fehler: ${insertErr.message}`); return; }
    const { data } = await supabase.from('auslaenderbehoerden').select('*').order('name');
    if (data) setEntries(data);
    setShowAddABH(false);
  }

  async function editABH(id: number, patch: Partial<ABHEntry>) {
    const original = entries.find(e => e.id === id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    const { error: updateErr } = await supabase.from('auslaenderbehoerden').update(patch).eq('id', id);
    if (updateErr) {
      if (original) setEntries(prev => prev.map(e => e.id === id ? original : e));
      setError(`Fehler beim Speichern: ${updateErr.message}`);
      return;
    }
    // Cascade shared fields to the corresponding lead (matched by original name)
    if (original) {
      const merged = { ...original, ...patch };
      const einwStr = merged.einwohner?.replace?.(/\D/g, '') ?? null;
      await supabase.from('leads').update({
        name:           merged.name           || original.name,
        stadt:          merged.stadt          || null,
        land:           merged.land           || null,
        buergermeister: merged.buergermeister || null,
        partei:         merged.partei         || null,
        kontaktdaten:   merged.kontaktdaten   || null,
        einwohner:      einwStr ? parseInt(einwStr, 10) : null,
      }).eq('name', original.name);
    }
    setEditingEntry(null);
  }

  async function deleteABH(id: number) {
    setEntries(prev => prev.filter(e => e.id !== id));
    setConfirmDeleteId(null);
    const { error: deleteErr } = await supabase.from('auslaenderbehoerden').delete().eq('id', id);
    if (deleteErr) {
      setError(`Fehler beim Löschen: ${deleteErr.message}`);
      // Re-fetch to restore state if delete failed
      supabase.from('auslaenderbehoerden').select('*').order('name').then(({ data }) => { if (data) setEntries(data); });
    }
  }

  const uniqueBundeslander = Array.from(new Set(entries.map(e => e.land).filter(Boolean) as string[])).sort();
  const uniqueParteien = Array.from(new Set(entries.map(e => e.partei?.trim()).filter(p => p && p !== '#N/A') as string[])).sort((a, b) => a.localeCompare(b, 'de'));

  const filteredEntries = entries.filter(e => {
    if (searchTerm && !Object.values(e).some(v => v && String(v).toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    if (bundeslandFilter && e.land !== bundeslandFilter) return false;
    if (parteiFilter && e.partei?.trim() !== parteiFilter) return false;
    if (hideLeads && leadStatus.has(e.name)) return false;
    if (excludedBundeslaender.size > 0 && excludedBundeslaender.has(e.land ?? '')) return false;
    if (sizeFilter) {
      const n = parseInt((e.einwohner ?? '').replace(/\D/g, ''), 10) || 0;
      if (sizeFilter === 'N.N.' && n > 0) return false;
      if (sizeFilter === 'Millionenstadt' && !(n >= 1_000_000)) return false;
      if (sizeFilter === 'Groß' && !(n >= 100_000 && n < 1_000_000)) return false;
      if (sizeFilter === 'Mittel' && !(n >= 20_000 && n < 100_000)) return false;
      if (sizeFilter === 'Klein' && !(n > 0 && n < 20_000)) return false;
    }
    return true;
  });

  const finalDisplayEntries = sortCol === null ? filteredEntries : [...filteredEntries].sort((a, b) => {
    if (sortCol === 'einwohner') {
      const aN = parseInt((a.einwohner ?? '').replace(/\D/g, ''), 10) || 0;
      const bN = parseInt((b.einwohner ?? '').replace(/\D/g, ''), 10) || 0;
      if (aN === 0 && bN === 0) return 0;
      if (aN === 0) return 1; if (bN === 0) return -1;
      return sortDir === 'asc' ? aN - bN : bN - aN;
    }
    if (sortCol === 'kontakt') {
      const aOrd = STATUS_ORDER[leadStatus.get(a.name) ?? ''] ?? -1;
      const bOrd = STATUS_ORDER[leadStatus.get(b.name) ?? ''] ?? -1;
      return sortDir === 'asc' ? aOrd - bOrd : bOrd - aOrd;
    }
    if (sortCol === 'typ') {
      const cmp = deriveTyp(a.name).localeCompare(deriveTyp(b.name), 'de', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const av = (a[sortCol] ?? '') as string;
    const bv = (b[sortCol] ?? '') as string;
    const empty = new Set(['', '#n/a', 'n/a', 'n.n.', '-']);
    const ae = empty.has(av.trim().toLowerCase()), be = empty.has(bv.trim().toLowerCase());
    if (ae && be) return 0; if (ae) return 1; if (be) return -1;
    const cmp = av.localeCompare(bv, 'de', { sensitivity: 'base' });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const showAll = rowsPerPage === 0;
  const effectiveRows = showAll ? finalDisplayEntries.length : rowsPerPage;
  const indexOfFirst = (currentPage - 1) * effectiveRows;
  const pageEntries = showAll ? finalDisplayEntries : finalDisplayEntries.slice(indexOfFirst, indexOfFirst + effectiveRows);
  const totalPages = showAll ? 1 : Math.ceil(finalDisplayEntries.length / effectiveRows);

  function leadRowStyle(status: string | undefined): React.CSSProperties {
    switch (status) {
      case 'kontaktiert':           return { borderLeft: '4px solid #7c3aed' };
      case 'persönlicher kontakt':  return { borderLeft: '4px solid #ea580c' };
      case 'antwort':               return { borderLeft: '4px solid #0284c7' };
      case 'zusage':                return { borderLeft: '4px solid #16a34a' };
      case VERBINDLICHE_ZUSAGE:     return { borderLeft: '4px solid #059669' };
      case 'abgeschlossen':         return { borderLeft: '4px solid #16a34a' };
      case 'abgelehnt':             return { borderLeft: '4px solid #dc2626' };
      default:                      return {};
    }
  }

  function handleSort(col: SortField) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const dragScroll = useDragScroll();

  function renderCell(entry: ABHEntry, col: SortField): ReactNode {
    const val = (entry[col] ?? '') as string;

    if (col === 'name') {
      if (!val) return null;
      return <a href={`https://www.google.com/search?q=${encodeURIComponent(val)}`} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">{val}</a>;
    }
    if (col === 'einwohner') {
      const cat = getCitySizeCategory(val);
      return <div className="flex w-full justify-center"><div className={`table-button ${categoryClassMap[cat] || ''}`}>{cat}</div></div>;
    }
    if (col === 'kontakt') {
      const st = leadStatus.get(entry.name);
      if (st) return <div className="flex w-full justify-center"><div className={`table-button ${leadStatusClass[st] ?? ''}`}>{st}</div></div>;
      return <div className="flex w-full justify-center text-[color:var(--muted)]">—</div>;
    }
    if (col === 'partei') {
      const party = val.trim();
      if (!party || party === '#N/A') return null;
      return (
        <div className="flex w-full justify-center">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${parteiCls(party)}`}>
            {party}
          </span>
        </div>
      );
    }
    if (col === 'typ') {
      // Prefer stored typ; fall back to name-derived value
      const typ = entry.typ?.trim() || deriveTyp(entry.name);
      const cls = /^Stadt$/i.test(typ)     ? 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
                : /Landkreis|Kreis/i.test(typ) ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-[color:var(--surface-muted)] text-[color:var(--muted)] border border-[color:var(--border)]';
      return <div className="flex w-full justify-center"><div className={`table-button ${cls}`}>{typ}</div></div>;
    }
    if (col === 'adresse') {
      return val ? (
        <div className="line-clamp-2 break-words leading-snug">
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val)}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{val}</a>
        </div>
      ) : null;
    }
    if (col === 'website') {
      return val ? (
        <div className="max-w-[180px] truncate whitespace-nowrap">
          <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{val}</a>
        </div>
      ) : null;
    }
    if (col === 'kontaktdaten') {
      return (
        <div className="flex flex-col gap-0.5 font-mono text-xs">
          {val.split(/[;,]/).map(e => e.trim()).filter(Boolean).map((email, i) => (
            <a key={i} href={`mailto:${email}`} className="max-w-[200px] truncate underline-offset-2 hover:underline">{email}</a>
          ))}
        </div>
      );
    }
    if (col === 'telefon') {
      return <div className="whitespace-nowrap tabular-nums">{val}</div>;
    }
    return <div className="line-clamp-2 break-words leading-snug">{val}</div>;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">ABH Datenbank</h1>
            <p className="text-sm text-[color:var(--muted)]">Suche, filtere und blättere durch die Ausländerbehörden.</p>
          </div>
          <div className="flex items-center gap-3">
            {entries.length > 0 && (
              <div className="text-sm text-[color:var(--muted)]">
                {finalDisplayEntries.length !== entries.length
                  ? <><span className="font-medium text-[color:var(--foreground)]">{finalDisplayEntries.length}</span> von {entries.length} Einträgen</>
                  : <>{entries.length} Einträge</>
                }
              </div>
            )}
            <button
              onClick={importFromCSV}
              disabled={importing}
              title="Fehlende Koordinaten und Daten aus der CSV-Datei synchronisieren"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-medium text-[color:var(--foreground)] shadow-sm transition-colors hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M10 6A4 4 0 1 1 6 2M6 2l2 2M6 2l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {importing ? 'Sync…' : 'CSV sync'}
            </button>
            <button onClick={() => setShowAddABH(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-medium text-[color:var(--foreground)] shadow-sm transition-colors hover:bg-[color:var(--surface-hover)]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              ABH hinzufügen
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]">{error}</div>
        )}

        {loading && (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-6 text-sm text-[color:var(--muted-strong)] shadow-sm">Lade Daten…</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-10 text-center shadow-sm">
            <p className="mb-1 text-sm font-medium text-[color:var(--foreground)]">Keine Einträge in der Datenbank.</p>
            <p className="mb-5 text-sm text-[color:var(--muted)]">Importiere die vorhandene CSV-Datei einmalig in die Datenbank.</p>
            <button
              onClick={importFromCSV}
              disabled={importing}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {importing ? 'Importiere…' : 'CSV importieren'}
            </button>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
            <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                <div className="md:col-span-4">
                  <label htmlFor="search" className="mb-1 block text-sm font-medium text-[color:var(--muted-strong)]">Suche</label>
                  <input id="search" type="text" placeholder="Name, Stadt…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-10 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="bundesland" className="mb-1 block text-sm font-medium text-[color:var(--muted-strong)]">Bundesland</label>
                  <div className="relative">
                    <select id="bundesland" value={bundeslandFilter} onChange={e => setBundeslandFilter(e.target.value)} className="h-10 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">
                      <option value="">Alle</option>
                      {uniqueBundeslander.map(bl => <option key={bl} value={bl}>{bl}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="partei" className="mb-1 block text-sm font-medium text-[color:var(--muted-strong)]">Partei</label>
                  <div className="relative">
                    <select id="partei" value={parteiFilter} onChange={e => setParteiFilter(e.target.value)} className="h-10 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">
                      <option value="">Alle Parteien</option>
                      {uniqueParteien.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="sizeFilter" className="mb-1 block text-sm font-medium text-[color:var(--muted-strong)]">Stadtgröße</label>
                  <div className="relative">
                    <select id="sizeFilter" value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="h-10 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">
                      <option value="">Alle Größen</option>
                      <option value="Millionenstadt">Millionenstadt (≥ 1 Mio.)</option>
                      <option value="Groß">Großstadt (100k–1 Mio.)</option>
                      <option value="Mittel">Mittelstadt (20k–100k)</option>
                      <option value="Klein">Kleinstadt (&lt; 20k)</option>
                      <option value="N.N.">Unbekannt</option>
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="excludeBl" className="mb-1 block text-sm font-medium text-[color:var(--muted-strong)]">Ausschließen</label>
                  <div className="relative">
                    <select id="excludeBl" value="" onChange={e => { const v = e.target.value; if (!v) return; setExcludedBundeslaender(p => new Set([...p, v])); setBundeslandFilter(f => f === v ? '' : f); }} className="h-10 w-full appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-9 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">
                      <option value="">Bundesland…</option>
                      {uniqueBundeslander.filter(bl => !excludedBundeslaender.has(bl)).map(bl => <option key={bl} value={bl}>{bl}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <div className="md:col-span-12 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={hideLeads} onChange={e => setHideLeads(e.target.checked)} className="h-4 w-4 rounded border-[color:var(--border-strong)] accent-violet-600 cursor-pointer" />
                    <span className="text-sm text-[color:var(--muted-strong)]">
                      Bereits hinzugefügte ausblenden
                      {hideLeads && leadStatus.size > 0 && <span className="ml-1 text-[color:var(--muted)]">({leadStatus.size})</span>}
                    </span>
                  </label>
                  {excludedBundeslaender.size > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-[color:var(--muted)]">Ausgeschlossen:</span>
                      {[...excludedBundeslaender].map(bl => (
                        <button key={bl} onClick={() => setExcludedBundeslaender(p => { const s = new Set(p); s.delete(bl); return s; })} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                          {bl}
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
              <div ref={dragScroll.ref} className="overflow-x-auto cursor-grab" onMouseDown={dragScroll.onMouseDown} onMouseMove={dragScroll.onMouseMove} onMouseUp={dragScroll.onMouseUp} onMouseLeave={dragScroll.onMouseLeave}>
                <table className="w-full border-collapse text-sm text-[color:var(--muted-strong)]">
                  <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--muted)]">
                    <tr className="bg-[color:var(--surface-muted)]">
                      <th scope="col" style={{ minWidth: '44px' }} className="sticky top-0 border-b border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-3" />
                      <th scope="col" style={{ minWidth: '36px' }} className="sticky top-0 border-b border-[color:var(--border)] bg-[color:var(--surface-muted)] px-1 py-3" />
                      {COLUMNS.map(col => (
                        <th key={col.key} scope="col" onClick={() => handleSort(col.key)} style={{ minWidth: col.width }} className="sticky top-0 cursor-pointer select-none border-b border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3 font-semibold hover:bg-[color:var(--surface-hover)] transition-colors" aria-sort={sortCol === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <span className="inline-flex items-center">{col.label}<SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.length > 0 ? (
                      pageEntries.map((entry, rowIndex) => {
                        const leadSt = leadStatus.get(entry.name);
                        const isLead = !!leadSt;
                        const isAdding = addingLead === entry.name;
                        return (
                          <tr
                            key={entry.id}
                            className={`animate-row-in hover:bg-[color:var(--surface-hover)] ${leadSt ? `lead-${leadSt}` : ''}`}
                            style={{ animationDelay: `${rowIndex * 25}ms`, ...leadRowStyle(leadSt) }}
                          >
                            <td className="px-2 py-2.5 align-middle">
                              <button
                                onClick={() => { if (!isLead && !isAdding) setPendingLeadEntry(entry); }}
                                disabled={isLead || isAdding}
                                title={isLead ? 'Bereits als Lead gespeichert' : 'Als Lead hinzufügen'}
                                className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${isLead ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300 cursor-default' : 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50'}`}
                              >
                                {isAdding ? '…' : isLead ? '✓' : '+'}
                              </button>
                            </td>
                            <td className="px-1 py-2.5 align-middle">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setConfirmDeleteId(null); setEditingEntry(entry); }} title="Eintrag bearbeiten" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]">
                                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M8.5 1.5a1.5 1.5 0 0 1 2.121 2.121L4 10.243 1 11l.757-3L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                {confirmDeleteId === entry.id ? (
                                  <>
                                    <button onClick={() => deleteABH(entry.id)} className="h-7 rounded-md bg-red-500 px-2 text-xs font-medium text-white hover:bg-red-600 transition-colors">
                                      Löschen
                                    </button>
                                    <button onClick={() => setConfirmDeleteId(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[color:var(--border)] text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] transition-colors text-xs">
                                      ✕
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => setConfirmDeleteId(entry.id)} title="Eintrag löschen" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400">
                                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 3h8M5 3V2h2v1M4.5 3v6.5M7.5 3v6.5M3 3l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                            {COLUMNS.map(col => (
                              <td key={col.key} title={(entry[col.key] ?? '') as string} className="px-3 py-2.5 align-middle">
                                {renderCell(entry, col.key)}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={COLUMNS.length + 2} className="px-3 py-12 text-center">
                          <p className="text-sm font-medium text-[color:var(--foreground)]">Keine Einträge gefunden.</p>
                          {(searchTerm || bundeslandFilter || parteiFilter || hideLeads || excludedBundeslaender.size > 0 || sizeFilter) && (
                            <button onClick={() => { setSearchTerm(''); setBundeslandFilter(''); setParteiFilter(''); setSortCol(null); setSortDir('asc'); setHideLeads(false); setExcludedBundeslaender(new Set()); setSizeFilter(''); }} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              Filter zurücksetzen
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-[color:var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-[color:var(--muted)]">{finalDisplayEntries.length} Ergebnis{finalDisplayEntries.length !== 1 ? 'se' : ''}</p>
                  {(searchTerm || bundeslandFilter || parteiFilter || hideLeads || excludedBundeslaender.size > 0 || sizeFilter) && (
                    <button onClick={() => { setSearchTerm(''); setBundeslandFilter(''); setParteiFilter(''); setSortCol(null); setSortDir('asc'); setHideLeads(false); setExcludedBundeslaender(new Set()); setSizeFilter(''); }} className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-hover)]">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Filter zurücksetzen
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor="rowsPerPage" className="text-sm font-medium text-[color:var(--muted-strong)]">Zeilen</label>
                    <div className="relative">
                      <select id="rowsPerPage" value={rowsPerPage} onChange={e => { const v = Number(e.target.value); if (v === 0) { setShowAllModal(true); return; } setRowsPerPage(v); }} className="h-9 appearance-none rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-3 pr-8 text-sm text-[color:var(--foreground)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]">
                        <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option><option value={0}>Alle</option>
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[color:var(--muted-strong)]">
                    <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="inline-flex h-9 flex-shrink-0 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 font-semibold text-[color:var(--foreground)] shadow-sm transition-colors hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" aria-label="Vorherige Seite">Zurück</button>
                    <span className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 font-medium text-[color:var(--muted-strong)]">Seite {currentPage} von {totalPages || 1}</span>
                    <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="inline-flex h-9 flex-shrink-0 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 font-semibold text-[color:var(--foreground)] shadow-sm transition-colors hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]" aria-label="Nächste Seite">Weiter</button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {pendingLeadEntry && (
        <AddLeadModal
          name={pendingLeadEntry.name}
          onConfirm={(von, notes, status, crmId) => { addLead(pendingLeadEntry, von, notes, status, crmId); setPendingLeadEntry(null); }}
          onCancel={() => setPendingLeadEntry(null)}
        />
      )}
      {showAllModal && (
        <ConfirmModal
          count={finalDisplayEntries.length}
          onConfirm={() => { setRowsPerPage(0); setShowAllModal(false); }}
          onCancel={() => setShowAllModal(false)}
        />
      )}
      {showAddABH && <AddABHModal onSave={saveABH} onCancel={() => setShowAddABH(false)} />}
      {editingEntry && <EditABHModal entry={editingEntry} onSave={editABH} onCancel={() => setEditingEntry(null)} />}
    </main>
  );
}
