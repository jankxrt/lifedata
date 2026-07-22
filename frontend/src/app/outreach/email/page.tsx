"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Lead } from '@/lib/supabase';

// ── People ────────────────────────────────────────────────────────────────────
const VON_PEOPLE = [
  { key: 'all', label: 'Alle',  fullName: null },
  { key: 'JK',  label: 'JK',   fullName: 'Jan Kortmann' },
  { key: 'RG',  label: 'RG',   fullName: 'Ramin Goo' },
  { key: 'IM',  label: 'IM',   fullName: 'Isabel Magallanes' },
  { key: 'BS',  label: 'BS',   fullName: 'Barbara Stasiak' },
];

type AnredeType = 'herr' | 'frau';
type OrtTyp     = 'stadt' | 'landkreis';

type TemplateFields = {
  behörde:  string;
  stadt:    string;
  typ:      OrtTyp;
  anrede:   AnredeType;
  name:     string;     // Bürgermeister nachname
  deadline: string;     // e.g. "22.05.2026"
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractNachname(bm: string | null): string {
  if (!bm) return '';
  const words = bm.trim().split(/\s+/);
  const skip = new Set(['dr.', 'dr', 'prof.', 'prof', 'dipl.', 'mag.', 'herr', 'frau',
    'oberbürgermeister', 'oberbürgermeisterin', 'bürgermeister', 'bürgermeisterin',
    'landrat', 'landrätin']);
  const meaningful = words.filter(w => !skip.has(w.toLowerCase()));
  return meaningful[meaningful.length - 1] ?? bm;
}

/** Strip common ABH/Ausländerbehörde prefixes from the lead name. */
function stripBehörde(name: string): string {
  return name
    .replace(/^Ausländerbehörde[n]?\s+(der\s+Stadt\s+|des\s+Landkreises?\s+|des\s+Kreises?\s+|der\s+|des\s+)?/i, '')
    .replace(/^ABH\s+/i, '')
    .trim();
}

/** Auto-detect whether a name refers to a Landkreis or Stadt. */
function detectTyp(name: string): OrtTyp {
  const l = name.toLowerCase();
  if (/landkreis|lk\s|\blk\b/.test(l)) return 'landkreis';
  return 'stadt';
}

function buildAnrede(type: AnredeType, name: string): string {
  const title = type === 'herr' ? 'Herr' : 'Frau';
  return `Sehr geehrter ${title} ${name},`.replace('Sehr geehrter Frau', 'Sehr geehrte Frau');
}

function ortPhrase(f: TemplateFields): string {
  const n = f.stadt || (f.typ === 'landkreis' ? '[Landkreis]' : '[Stadt]');
  return f.typ === 'landkreis' ? `den Landkreis ${n}` : `die Stadt ${n}`;
}

function buildPlainText(f: TemplateFields): string {
  const anredeStr = f.name
    ? buildAnrede(f.anrede, f.name)
    : 'Sehr geehrte/r Herr/Frau Bürgermeister/in,';

  return [
    `Betreff: Verwaltungsmodernisierung der Ausländerbehörde ${f.behörde || '[Behörde]'}: Einladung zur Partnerschaft`,
    '',
    anredeStr,
    '',
    'Ausländerbehörden spielen eine zentrale Rolle für die Integration internationaler Fachkräfte – doch sie arbeiten dabei täglich am Limit ihrer Kapazitäten und stehen unter erheblichem Druck. Lange Verfahren und komplexe Kommunikation belasten Verwaltung, Mitarbeitende und Antragstellende gleichermaßen und binden dringend benötigte Ressourcen.',
    '',
    'Hier setzt das von der Bundesregierung geförderte Projekt zur Modernisierung von Verwaltungsabläufen der Life Initiative e.V. an: Ziel ist es, die Kommunikation mit Antragstellenden zu verbessern, Bürokratie abzubauen und Integration zu stärken.',
    '',
    'Gemeinsam mit voraussichtlich sechs im Projekt beteiligten Kommunen entwickeln wir praxiserprobte, rechtssichere Werkzeuge, die Prozesse spürbar vereinfachen und Mitarbeitende nachhaltig entlasten.',
    '',
    `Wir laden ${ortPhrase(f)} gezielt als Partnerbehörde ein. Als teilnehmende Kommune gestalten Sie die entwickelten Lösungen aktiv mit, erhalten Zugang zu Analysen aus Falldokumentationen und Befragungen und positionieren Ihre ${f.typ === 'landkreis' ? 'Kreisverwaltung' : 'Stadt'} bundesweit als Vorreiter moderner Integrationsverwaltung – bei einem Aufwand von rund vier Online-Terminen jährlich.`,
    '',
    `Wir freuen uns über eine Rückmeldung bis zum ${f.deadline || '[Datum]'}, frühzeitige Rückmeldungen können bei der Vergabe der Projektplätze bevorzugt berücksichtigt werden. Gerne stellen wir Ihnen das Projekt auch in einem kurzen Telefonat persönlich vor und beantworten Ihre Fragen – sprechen Sie uns einfach an.`,
    '',
    'Wir freuen uns darauf, gemeinsam neue Impulse für moderne Verwaltungsprozesse zu setzen und in den Austausch zu gehen.',
    '',
    'Mit freundlichen Grüßen',
    'Isabel Magallanes',
    'Referentin für die Kommunalberatung',
    '',
    'Mobil: +49 151 50715336',
    'WhatsApp: +49 151 50715336',
  ].join('\n');
}

function buildHtml(f: TemplateFields): string {
  const anredeStr = f.name
    ? buildAnrede(f.anrede, f.name)
    : 'Sehr geehrte/r Herr/Frau Bürgermeister/in,';
  const behörde  = f.behörde  || '[Behörde]';
  const deadline = f.deadline || '[Datum]';
  const ort      = ortPhrase(f);
  const verweis  = f.typ === 'landkreis' ? 'Kreisverwaltung' : 'Stadt';

  const p = (content: string) =>
    `<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.38;margin:12pt 0;">${content}</p>`;

  return `<div style="font-family:Arial,sans-serif;font-size:11pt;color:#000000;">
${p(`<strong><em>Betreff: Verwaltungsmodernisierung der Ausländerbehörde ${behörde}: Einladung zur Partnerschaft</em></strong>`)}
${p(anredeStr)}
${p('Ausländerbehörden spielen eine zentrale Rolle für die Integration internationaler Fachkräfte – doch sie arbeiten dabei täglich am Limit ihrer Kapazitäten und stehen unter erheblichem Druck. Lange Verfahren und komplexe Kommunikation belasten Verwaltung, Mitarbeitende und Antragstellende gleichermaßen und binden dringend benötigte Ressourcen.')}
${p('Hier setzt das <strong>von der Bundesregierung geförderte Projekt zur Modernisierung von Verwaltungsabläufen</strong> der Life Initiative e.V. an: Ziel ist es, die Kommunikation mit Antragstellenden zu verbessern, Bürokratie abzubauen und Integration zu stärken.')}
${p('Gemeinsam mit voraussichtlich sechs im Projekt beteiligten Kommunen entwickeln wir praxiserprobte, rechtssichere Werkzeuge, die Prozesse spürbar vereinfachen und Mitarbeitende nachhaltig entlasten.')}
${p(`Wir laden ${ort} gezielt als Partnerbehörde ein. Als teilnehmende Kommune gestalten Sie die entwickelten Lösungen aktiv mit, erhalten Zugang zu Analysen aus Falldokumentationen und Befragungen und positionieren Ihre ${verweis} bundesweit als Vorreiter moderner Integrationsverwaltung – bei einem Aufwand von rund vier Online-Terminen jährlich.`)}
${p(`Wir freuen uns über eine <strong>Rückmeldung bis zum ${deadline}</strong>, frühzeitige Rückmeldungen können bei der Vergabe der Projektplätze bevorzugt berücksichtigt werden. Gerne stellen wir Ihnen das Projekt auch in einem kurzen Telefonat persönlich vor und beantworten Ihre Fragen – sprechen Sie uns einfach an.`)}
${p('Wir freuen uns darauf, gemeinsam neue Impulse für moderne Verwaltungsprozesse zu setzen und in den Austausch zu gehen.')}
<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.38;margin:8pt 0;">Mit freundlichen Grüßen</p>
<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.38;margin:4pt 0;"><strong><em>Isabel Magallanes</em></strong></p>
<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.38;margin:4pt 0;"><strong><em>Referentin für die Kommunalberatung</em></strong></p>
<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.38;margin:12pt 0;">Mobil: +49 151 50715336<br>WhatsApp: +49 151 50715336</p>
</div>`;
}

// ── Template preview ───────────────────────────────────────────────────────────
function Hi({ val, placeholder }: { val: string; placeholder: string }) {
  const empty = !val.trim();
  return (
    <mark
      className="rounded-sm px-0.5"
      style={{ background: empty ? '#fef08a' : '#bbf7d0', color: 'inherit' }}
    >
      {empty ? placeholder : val}
    </mark>
  );
}

function TemplatePreview({ f }: { f: TemplateFields }) {
  const anredeStr = f.name ? buildAnrede(f.anrede, f.name) : undefined;
  const stadtLabel = f.typ === 'landkreis' ? 'Landkreis' : 'Stadt';
  const verweis    = f.typ === 'landkreis' ? 'Kreisverwaltung' : 'Stadt';

  return (
    <div className="space-y-4 text-sm leading-relaxed text-[color:var(--foreground)]" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Subject */}
      <p className="font-bold">
        Betreff: Verwaltungsmodernisierung der Ausländerbehörde{' '}
        <Hi val={f.behörde} placeholder="Behörde" />
        : Einladung zur Partnerschaft
      </p>

      {/* Greeting */}
      <p>
        <Hi val={anredeStr ?? ''} placeholder="Sehr geehrte/r Herr/Frau Bürgermeister*in," />
      </p>

      {/* Para 1 */}
      <p>
        Ausländerbehörden spielen eine zentrale Rolle für die Integration internationaler Fachkräfte – doch sie arbeiten dabei täglich am Limit ihrer Kapazitäten und stehen unter erheblichem Druck. Lange Verfahren und komplexe Kommunikation belasten Verwaltung, Mitarbeitende und Antragstellende gleichermaßen und binden dringend benötigte Ressourcen.
      </p>

      {/* Para 2 */}
      <p>
        Hier setzt das <strong>von der Bundesregierung geförderte Projekt zur Modernisierung von Verwaltungsabläufen</strong> der Life Initiative e.V. an: Ziel ist es, die Kommunikation mit Antragstellenden zu verbessern, Bürokratie abzubauen und Integration zu stärken.
      </p>

      {/* Para 3 */}
      <p>
        Gemeinsam mit voraussichtlich sechs im Projekt beteiligten Kommunen entwickeln wir praxiserprobte, rechtssichere Werkzeuge, die Prozesse spürbar vereinfachen und Mitarbeitende nachhaltig entlasten.
      </p>

      {/* Para 4 — Stadt / Landkreis */}
      <p>
        Wir laden {f.typ === 'landkreis' ? 'den Landkreis' : 'die Stadt'}{' '}
        <Hi val={f.stadt} placeholder={stadtLabel} />{' '}
        gezielt als Partnerbehörde ein. Als teilnehmende Kommune gestalten Sie die entwickelten Lösungen aktiv mit, erhalten Zugang zu Analysen aus Falldokumentationen und Befragungen und positionieren Ihre {verweis} bundesweit als Vorreiter moderner Integrationsverwaltung – bei einem Aufwand von rund vier Online-Terminen jährlich.
      </p>

      {/* Para 5 */}
      <p>
        Wir freuen uns über eine <strong>Rückmeldung bis zum <Hi val={f.deadline} placeholder="Datum" /></strong>, frühzeitige Rückmeldungen können bei der Vergabe der Projektplätze bevorzugt berücksichtigt werden. Gerne stellen wir Ihnen das Projekt auch in einem kurzen Telefonat persönlich vor und beantworten Ihre Fragen – sprechen Sie uns einfach an.
      </p>

      {/* Para 6 */}
      <p>Wir freuen uns darauf, gemeinsam neue Impulse für moderne Verwaltungsprozesse zu setzen und in den Austausch zu gehen.</p>

      {/* Signature */}
      <div className="mt-2 space-y-0.5">
        <p>Mit freundlichen Grüßen</p>
        <p className="font-bold italic">Isabel Magallanes</p>
        <p className="font-bold italic">Referentin für die Kommunalberatung</p>
        <p className="mt-3 text-[color:var(--muted)]">Mobil: +49 151 50715336</p>
        <p className="text-[color:var(--muted)]">WhatsApp: +49 151 50715336</p>
      </div>
    </div>
  );
}

// ── Lead card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, selected, onClick }: { lead: Lead; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/40'
          : 'border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-hover)]',
      ].join(' ')}
    >
      <p className="text-sm font-medium text-[color:var(--foreground)] leading-tight">{lead.name}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {lead.stadt && <span className="text-xs text-[color:var(--muted)]">{lead.stadt}</span>}
        {lead.land  && <span className="text-xs text-[color:var(--muted)] opacity-60">{lead.land}</span>}
        {lead.von   && (
          <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
            {VON_PEOPLE.find(p => p.fullName === lead.von)?.label ?? lead.von}
          </span>
        )}
      </div>
      {lead.buergermeister && (
        <p className="mt-0.5 text-xs text-[color:var(--muted)] truncate">{lead.buergermeister}</p>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmailTemplatePage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [selectedLead, setSelectedLead]     = useState<Lead | null>(null);
  const [copied, setCopied]         = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const copyTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyHtmlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fields, setFields] = useState<TemplateFields>({
    behörde:  '',
    stadt:    '',
    typ:      'stadt',
    anrede:   'herr',
    name:     '',
    deadline: '22.05.2026',
  });

  useEffect(() => {
    supabase
      .from('leads')
      .select('*')
      .eq('status', 'neu')
      .order('name')
      .then(({ data }) => {
        if (data) setLeads(data);
        setLoading(false);
      });
  }, []);

  const selectLead = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    const rawName = lead.name ?? '';
    setFields(prev => ({
      ...prev,
      behörde: stripBehörde(rawName),
      stadt:   lead.stadt ?? '',
      typ:     detectTyp(rawName),
      anrede:  'herr',
      name:    extractNachname(lead.buergermeister),
    }));
  }, []);

  const filteredLeads = leads.filter(l => {
    if (selectedPerson === 'all') return true;
    const person = VON_PEOPLE.find(p => p.key === selectedPerson);
    return l.von === person?.fullName;
  });

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(buildPlainText(fields));
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }

  function copyHtmlToClipboard() {
    const html = buildHtml(fields);

    // Place an off-screen contenteditable div, select its contents, and
    // execCommand('copy'). The contenteditable flag is what tells the browser
    // to put rich HTML (not just plain text) onto the clipboard.
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    // Off-screen but NOT clipped (no overflow:hidden, no width:1px).
    el.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px;';
    el.innerHTML = html;
    document.body.appendChild(el);

    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('copy');
    sel?.removeAllRanges();
    document.body.removeChild(el);

    setCopiedHtml(true);
    if (copyHtmlTimer.current) clearTimeout(copyHtmlTimer.current);
    copyHtmlTimer.current = setTimeout(() => setCopiedHtml(false), 2500);
  }

  const inputCls = "h-8 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2.5 text-sm text-[color:var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";
  const toggleBtn = (active: boolean) => [
    'flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors',
    active
      ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-300'
      : 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)]',
  ].join(' ');

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <a href="/outreach" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors">
                ← Outreach
              </a>
              <span className="text-[color:var(--muted)] opacity-40">/</span>
              <span className="text-sm font-medium">E-Mail Vorlage</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">E-Mail Vorlage</h1>
            <p className="text-sm text-[color:var(--muted)]">Wähle eine Person und einen Lead, um die Vorlage zu befüllen.</p>
          </div>
        </div>

        {/* Person filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-[color:var(--muted)] mr-1">Person:</span>
          {VON_PEOPLE.map(p => {
            const count = p.key === 'all'
              ? leads.length
              : leads.filter(l => l.von === p.fullName).length;
            return (
              <button
                key={p.key}
                onClick={() => setSelectedPerson(p.key)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  selectedPerson === p.key
                    ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-300'
                    : 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]',
                ].join(' ')}
              >
                {p.label}
                <span className={[
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold',
                  selectedPerson === p.key
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300'
                    : 'bg-[color:var(--surface-muted)] text-[color:var(--muted)]',
                ].join(' ')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">

          {/* LEFT: Lead list */}
          <aside className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Neue Leads
              <span className="ml-1.5 rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-xs font-semibold normal-case">
                {filteredLeads.length}
              </span>
            </p>

            {loading ? (
              <p className="text-sm text-[color:var(--muted)] py-4 text-center">Lade…</p>
            ) : filteredLeads.length === 0 ? (
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-6 text-center">
                <p className="text-sm text-[color:var(--muted)]">Keine neuen Leads.</p>
              </div>
            ) : (
              <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto pr-1">
                {filteredLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    selected={selectedLead?.id === lead.id}
                    onClick={() => selectLead(lead)}
                  />
                ))}
              </div>
            )}
          </aside>

          {/* RIGHT: Template editor + preview */}
          <div className="flex flex-col gap-4">
            {!selectedLead ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]">
                <div className="text-center">
                  <svg className="mx-auto mb-2 text-[color:var(--muted)]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">Kein Lead ausgewählt</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">Klicke links auf einen Lead, um die Vorlage zu befüllen.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Edit fields */}
                <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Felder anpassen</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--muted-strong)]">Behörde (Betreff)</label>
                      <input
                        className={inputCls}
                        value={fields.behörde}
                        onChange={e => setFields(f => ({ ...f, behörde: e.target.value }))}
                        placeholder="z.B. Bad Krozingen"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--muted-strong)]">Name (Stadt / Landkreis)</label>
                      <input
                        className={inputCls}
                        value={fields.stadt}
                        onChange={e => setFields(f => ({ ...f, stadt: e.target.value }))}
                        placeholder="z.B. Bad Krozingen"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--muted-strong)]">Typ</label>
                      <div className="flex gap-2">
                        <button onClick={() => setFields(f => ({ ...f, typ: 'stadt' }))}      className={toggleBtn(fields.typ === 'stadt')}>Stadt</button>
                        <button onClick={() => setFields(f => ({ ...f, typ: 'landkreis' }))} className={toggleBtn(fields.typ === 'landkreis')}>Landkreis</button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--muted-strong)]">Anrede</label>
                      <div className="flex gap-2">
                        <button onClick={() => setFields(f => ({ ...f, anrede: 'herr' }))} className={toggleBtn(fields.anrede === 'herr')}>Sehr geehrter Herr</button>
                        <button onClick={() => setFields(f => ({ ...f, anrede: 'frau' }))} className={toggleBtn(fields.anrede === 'frau')}>Sehr geehrte Frau</button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--muted-strong)]">Name (Bürgermeister/in)</label>
                      <input
                        className={inputCls}
                        value={fields.name}
                        onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
                        placeholder="z.B. Mäurer"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--muted-strong)]">Rückmeldung bis (Deadline)</label>
                      <input
                        className={inputCls}
                        value={fields.deadline}
                        onChange={e => setFields(f => ({ ...f, deadline: e.target.value }))}
                        placeholder="z.B. 22.05.2026"
                      />
                    </div>
                  </div>

                  {/* Lead summary */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[color:var(--border)] pt-3">
                    <span className="text-xs text-[color:var(--muted)]">
                      Lead: <span className="font-medium text-[color:var(--foreground)]">{selectedLead.name}</span>
                    </span>
                    {selectedLead.von && (
                      <span className="text-xs text-[color:var(--muted)]">
                        Zuständig: <span className="font-medium text-violet-600 dark:text-violet-400">
                          {VON_PEOPLE.find(p => p.fullName === selectedLead.von)?.label ?? selectedLead.von}
                        </span>
                      </span>
                    )}
                    {selectedLead.kontaktdaten && (
                      <span className="text-xs text-[color:var(--muted)]">
                        E-Mail: <span className="font-medium text-[color:var(--foreground)] font-mono">{selectedLead.kontaktdaten.split(/[;,]/)[0].trim()}</span>
                      </span>
                    )}
                  </div>
                </section>

                {/* Template preview */}
                <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
                  <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Vorschau</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyToClipboard}
                        className={[
                          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          copied
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                            : 'border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]',
                        ].join(' ')}
                      >
                        {copied
                          ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6.5L4.5 9.5L10.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Kopiert!</>
                          : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M8 4V2.5A1.5 1.5 0 0 0 6.5 1H2.5A1.5 1.5 0 0 0 1 2.5v4A1.5 1.5 0 0 0 2.5 8H4" stroke="currentColor" strokeWidth="1.2"/></svg>Text</>
                        }
                      </button>
                      <button
                        onClick={copyHtmlToClipboard}
                        className={[
                          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          copiedHtml
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                            : 'border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)]',
                        ].join(' ')}
                      >
                        {copiedHtml
                          ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6.5L4.5 9.5L10.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Kopiert!</>
                          : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9.5L4.5 7 2 4.5M5.5 9.5h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>HTML</>
                        }
                      </button>
                    </div>
                  </div>
                  <div className="px-6 py-5">
                    <TemplatePreview f={fields} />
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
