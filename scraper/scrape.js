/**
 * BAMF Navi Scraper
 * -----------------
 * For each row in the CSV:
 *   1. Search the Stadt on bamf-navi.bamf.de
 *   2. Click the first autocomplete suggestion
 *   3. In the results table find the row whose "Name" column best matches
 *      the CSV "Name" column (the ABH organisation name)
 *   4. Click its detail button
 *   5. Extract the mailto: email and write it to the "Kontaktdaten" column
 *
 * Usage:
 *   cd scraper
 *   npm install
 *   npm run install-browsers
 *   node scrape.js
 *
 * Options (env vars):
 *   HEADLESS=true   run without visible browser (default: false so you can watch)
 *   START=0         row index to start from (0-based, skips header)
 *   DELAY=2000      ms to wait between rows
 */

const { chromium } = require('playwright');
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const CSV_SRC   = path.resolve(__dirname, '../frontend/public/data/abs_bundesland.csv');
// CSV_OUT: if set, write output here instead of back to CSV_SRC.
// Default local output goes straight into the Next.js public folder so
// the dev server serves it at /data/abs_bundesland_local.csv automatically.
//
// Local run (safe):   node scrape.js
// Production update:  $env:CSV_OUT="../frontend/public/data/abs_bundesland.csv"; node scrape.js
const CSV_OUT_DEFAULT = path.resolve(__dirname, '../frontend/public/data/abs_bundesland_local.csv');
const CSV_OUT   = process.env.CSV_OUT ? path.resolve(process.cwd(), process.env.CSV_OUT) : CSV_OUT_DEFAULT;
const CSV_PATH  = CSV_SRC; // always read from production CSV as starting point
const BAMF_URL  = 'https://bamf-navi.bamf.de/de/Themen/Behoerden/';
const HEADLESS      = process.env.HEADLESS === 'true';
const START_ROW     = parseInt(process.env.START ?? '0', 10);
const DELAY_MS      = parseInt(process.env.DELAY ?? '2000', 10);
const REGEOCODE_ALL = process.env.REGEOCODE === 'true'; // clear & redo all coords

// Comma-separated Stadt names to force re-scrape even if already filled.
// Example: RESCRAPE="Grafschaft Bentheim,Ahrweiler" node scrape.js
const RESCRAPE_CITIES = new Set(
  (process.env.RESCRAPE ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
);

// ── CSV ───────────────────────────────────────────────────────────────────────
function readCSV(filepath) {
  let text = fs.readFileSync(filepath, 'utf8');
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/);
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function splitLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function quoteField(val) {
  const s = String(val ?? '');
  // Quote any field that contains a comma, double-quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function writeCSV(filepath, headers, rows) {
  const content = '﻿' + [
    headers.map(quoteField).join(','),
    ...rows.map(r => r.map(quoteField).join(','))
  ].join('\n');
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  // Atomic replace — on Windows renameSync can fail with EPERM if the file
  // is held open by the Next.js dev server, so fall back to direct write.
  try {
    fs.renameSync(tmp, filepath);
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EBUSY') {
      fs.writeFileSync(filepath, content, 'utf8');
      try { fs.unlinkSync(tmp); } catch {}
    } else {
      throw e;
    }
  }
}

// ── Name matching ─────────────────────────────────────────────────────────────
// Strip common German org-type prefixes so we compare the place/entity name only.
const PREFIX_RE = /^(abh|ausländerbehörde|stv|stadtverwaltung|lra|landratsamt|lhs|landeshauptstadt|bgm|bürgermeister|rp|regierungspräsidium|lhh|krv|lr|lea|rea|zab|zsv|kva|lh|stadt)\s+/gi;

function normalise(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(PREFIX_RE, '')
    .replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreMatch(csvName, bamfName) {
  const a = normalise(csvName).split(' ').filter(w => w.length > 2);
  const b = new Set(normalise(bamfName).split(' ').filter(w => w.length > 2));
  return a.filter(w => b.has(w)).length;
}

const MIN_MATCH_SCORE = 1; // at least 1 meaningful word must match

function pickBestRow(csvName, bamfNames) {
  let best = -1, bestScore = 0;
  bamfNames.forEach((n, i) => {
    const s = scoreMatch(csvName, n);
    if (s > bestScore) { bestScore = s; best = i; }
  });
  if (bestScore < MIN_MATCH_SCORE) return { idx: -1, matched: false };
  return { idx: best, matched: true };
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Core scrape for one row ───────────────────────────────────────────────────
async function scrapeDetails(page, csvName, stadtName) {
  // ── 1. Navigate ──────────────────────────────────────────────────────────
  await page.goto(BAMF_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // ── 2. Fill search input ─────────────────────────────────────────────────
  const input = page.locator('#mat-input-0');
  await input.waitFor({ timeout: 15_000 });
  await input.fill(stadtName);
  await sleep(1_800); // give Angular time to trigger autocomplete

  // ── 3. Click first autocomplete suggestion ───────────────────────────────
  // Angular Material renders options in a CDK overlay portal.
  // Each option is <mat-option> / <.mat-mdc-option>; the visible text is in a <span>.
  const optionSel = '.mat-mdc-autocomplete-panel .mat-mdc-option, .cdk-overlay-container .mat-mdc-option';
  try {
    await page.waitForSelector(optionSel, { timeout: 8_000 });
  } catch {
    console.log('    ↳ No autocomplete suggestions for', stadtName);
    return null;
  }


  // The user spec says: "click on the first <span> it finds" inside the option
  const firstOptionSpan = page.locator(`${optionSel} span.mat-mdc-option-text, ${optionSel} span`).first();
  await firstOptionSpan.click();
  await sleep(1_000);

  // ── 4. Click "Tabelle öffnen" to open the results list view ────────────
  try {
    await page.waitForSelector('span.maxBreite', { timeout: 5_000 });
    await page.locator('span.maxBreite').first().click();
    await sleep(2_000);
  } catch {
    console.log('    ↳ "Tabelle öffnen" button not found, continuing without it…');
  }

  // ── 5. Wait for results table ────────────────────────────────────────────
  const tableSel = 'table.behoerden';
  try {
    await page.waitForSelector(tableSel, { timeout: 12_000 });
  } catch {
    console.log('    ↳ Results table did not appear for', stadtName);
    return null;
  }

  // ── 6. Identify "Name" column index from thead ───────────────────────────
  const thTexts = await page.$$eval(`${tableSel} thead th`, ths =>
    ths.map(th => th.textContent?.trim() ?? '')
  );
  const nameColIdx = thTexts.findIndex(t => /^name$/i.test(t));
  if (nameColIdx < 0) {
    console.log('    ↳ Could not find "Name" column in thead');
    return null;
  }

  // ── 6. Collect tbody row names + locate rows ─────────────────────────────
  const tbodyRows = await page.locator(`${tableSel} tbody tr`).all();
  if (tbodyRows.length === 0) {
    console.log('    ↳ Table is empty for', stadtName);
    return null;
  }

  const bamfNames = await Promise.all(
    tbodyRows.map(row =>
      row.locator('td').nth(nameColIdx).textContent().catch(() => '')
    )
  );

  // ── 7. Pick best matching row ────────────────────────────────────────────
  const { idx, matched } = pickBestRow(csvName, bamfNames);
  if (!matched) {
    console.log(`    ↳ ⚠️  No name match found for "${csvName}" — skipping to avoid wrong data.`);
    console.log(`    ↳    Available: ${bamfNames.map(n => `"${n?.trim()}"`).join(', ')}`);
    return null;
  }
  console.log(`    ↳ Matched row ${idx}: "${bamfNames[idx]?.trim()}"`)

  // ── 8. Click detail button in that row ───────────────────────────────────
  // The button contains a <span class="mat-mdc-button-touch-target">
  const detailBtn = tbodyRows[idx].locator('button:has(.mat-mdc-button-touch-target), button').first();
  try {
    await detailBtn.click();
    await sleep(2_000);
  } catch {
    console.log('    ↳ Could not click detail button');
    return null;
  }

  // ── 9. Extract contact details from .objektinfoDetails ───────────────────
  try {
    await page.waitForSelector('.objektinfoDetails', { timeout: 8_000 });
  } catch {
    console.log('    ↳ Detail panel (.objektinfoDetails) did not appear');
    return null;
  }

  const details = await page.$eval('.objektinfoDetails', el => {
    const tel = el.querySelector('a[href^="tel:"]');
    const mail = el.querySelector('a[href^="mailto:"]');
    const web = el.querySelector('a[aria-label="Homepage"]');

    // Fax is in a .kontakt div whose text starts with "Fax"
    let fax = null;
    el.querySelectorAll('.kontakt').forEach(div => {
      const t = div.textContent?.trim() ?? '';
      if (/^fax/i.test(t)) {
        fax = t.replace(/^fax\s*/i, '').trim();
      }
    });

    // Address: street from navi-str-mit-zusatz span + the following postal/city text node
    let address = null;
    const streetEl = el.querySelector('navi-str-mit-zusatz span');
    if (streetEl) {
      const street = streetEl.textContent?.trim() ?? '';
      // Walk siblings after navi-str-mit-zusatz to find the postal+city text node
      let sibling = streetEl.closest('navi-str-mit-zusatz')?.nextSibling;
      let postalCity = '';
      while (sibling) {
        if (sibling.nodeType === Node.TEXT_NODE) {
          const t = sibling.textContent?.replace(/ /g, ' ').trim();
          if (t) { postalCity = t; break; }
        }
        sibling = sibling.nextSibling;
      }
      address = [street, postalCity].filter(Boolean).join(', ');
    }

    return {
      email:   mail ? mail.getAttribute('href').replace(/^mailto:/i, '').trim() : null,
      phone:   tel  ? tel.getAttribute('href').replace(/^tel:/i, '').trim()     : null,
      fax,
      website: web  ? web.getAttribute('href')?.trim()                          : null,
      address,
    };
  });

  return details;
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
// Strategy (most → least accurate):
//   1. Nominatim structured query: street + PLZ  (exact building)
//   2. Nominatim structured query: PLZ only       (postal code centroid — still unambiguous)
//   3. Photon full-address query                  (fuzzy fallback)
//   4. Photon city-name query                     (last resort)
//
// Nominatim rate-limit: 1 req/s — always sleep 1100 ms between calls.

function nominatimRequest(params) {
  return new Promise((resolve) => {
    const qs = new URLSearchParams({ ...params, countrycodes: 'de', format: 'json', limit: '1', 'accept-language': 'de' }).toString();
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?${qs}`,
      headers: { 'User-Agent': 'bamf-navi-scraper/1.0 (internal ABH index tool)' },
    };
    https.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const hit = data?.[0];
          if (hit?.lat && hit?.lon) return resolve({ lat: String(hit.lat), lng: String(hit.lon) });
        } catch (e) { console.log(`  ↳ Nominatim parse error: ${e.message}`); }
        resolve(null);
      });
    }).on('error', (e) => { console.log(`  ↳ Nominatim request error: ${e.message}`); resolve(null); });
  });
}

function photonQuery(q) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'photon.komoot.io',
      path: `/api/?q=${encodeURIComponent(q)}&lang=de&limit=1&bbox=5.87,47.27,15.04,55.06`,
      headers: { 'User-Agent': 'bamf-navi-scraper/1.0' },
    };
    https.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const feature = data?.features?.[0];
          if (feature) {
            const [lng, lat] = feature.geometry.coordinates;
            return resolve({ lat: String(lat), lng: String(lng) });
          }
        } catch (e) { console.log(`  ↳ Photon parse error: ${e.message}`); }
        resolve(null);
      });
    }).on('error', (e) => { console.log(`  ↳ Photon request error: ${e.message}`); resolve(null); });
  });
}

// Extract 5-digit German postal code from an address string
function extractPLZ(address) {
  const m = (address ?? '').match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

// Extract street + house number from address (everything before the PLZ)
function extractStreet(address) {
  const m = (address ?? '').match(/^([^,]+?)(?:\s*,\s*\d{5}|,\s*,)/);
  return m ? m[1].trim() : null;
}

async function geocode(address, city) {
  const plz    = extractPLZ(address);
  const street = extractStreet(address);

  // ── 1. Nominatim: street + PLZ (most accurate — exact building) ────────────
  if (plz && street) {
    const geo = await nominatimRequest({ street, postalcode: plz });
    await sleep(1100);
    if (geo) { console.log(`  ↳ 📍 geocoded via Nominatim street+PLZ (${plz}): ${geo.lat}, ${geo.lng}`); return geo; }
  }

  // ── 2. Nominatim: PLZ only (postal code centroid — unambiguous in Germany) ──
  if (plz) {
    const geo = await nominatimRequest({ postalcode: plz });
    await sleep(1100);
    if (geo) { console.log(`  ↳ 📍 geocoded via Nominatim PLZ ${plz}: ${geo.lat}, ${geo.lng}`); return geo; }
  }

  // ── 3. Photon: full address (fuzzy) ────────────────────────────────────────
  if (address) {
    const geo = await photonQuery(address + ', Deutschland');
    await sleep(1100);
    if (geo) { console.log(`  ↳ 📍 geocoded via Photon address: ${geo.lat}, ${geo.lng}`); return geo; }
  }

  // ── 4. Photon: city name only (last resort) ────────────────────────────────
  console.log(`  ↳ ⚠️  falling back to city-name geocode for "${city}"`);
  const geo = await photonQuery(city + ', Deutschland');
  if (geo) { console.log(`  ↳ 📍 geocoded via Photon city: ${geo.lat}, ${geo.lng}`); return geo; }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Reading CSV :', CSV_PATH);
  console.log('Writing to  :', CSV_OUT);
  if (CSV_OUT !== CSV_PATH) console.log('⚠️  LOCAL MODE — production CSV will NOT be modified.\n');
  else console.log('⚠️  PRODUCTION MODE — writing directly to production CSV.\n');

  // Always read from the production CSV as the authoritative base.
  // In local mode, wipe all scraped columns so everything is fetched fresh.
  // To resume an interrupted run use START=<row> — the skip logic handles already-done rows.
  const { headers, rows } = readCSV(CSV_SRC);

  if (CSV_OUT !== CSV_SRC) {
    const scrapedCols = ['Kontaktdaten', 'Telefon', 'Fax', 'Website', 'Adresse', 'Lat', 'Lng'];
    scrapedCols.forEach(col => {
      const idx = headers.findIndex(h => h.trim() === col);
      if (idx >= 0) rows.forEach(row => { row[idx] = ''; });
    });
    writeCSV(CSV_OUT, headers, rows);
    console.log(`✓ Clean local CSV ready — all scraped columns cleared.`);
    console.log(`  Tip: to resume after a crash use $env:START=<row number>\n`);
  } else {
    // Production mode: write initial state so the file exists before the loop
    writeCSV(CSV_OUT, headers, rows);
  }

  // Ensure contact columns exist
  function ensureCol(name) {
    let idx = headers.findIndex(h => h.trim() === name);
    if (idx < 0) {
      headers.push(name);
      idx = headers.length - 1;
      rows.forEach(row => { while (row.length < headers.length) row.push(''); });
      console.log(`Added "${name}" column.`);
    }
    return idx;
  }

  const kdIdx      = ensureCol('Kontaktdaten'); // email
  const phoneIdx   = ensureCol('Telefon');
  const faxIdx     = ensureCol('Fax');
  const websiteIdx = ensureCol('Website');
  const addrIdx    = ensureCol('Adresse');
  const latIdx     = ensureCol('Lat');
  const lngIdx     = ensureCol('Lng');

  const nameIdx  = headers.findIndex(h => h.trim() === 'Name');
  const stadtIdx = headers.findIndex(h => h.trim() === 'Stadt');

  if (nameIdx < 0 || stadtIdx < 0) {
    console.error('CSV must have "Name" and "Stadt" columns.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: HEADLESS, slowMo: 50 });
  const context = await browser.newContext({ locale: 'de-DE' });
  const page    = await context.newPage();

  let processed = 0, found = 0, skipped = 0;

  for (let i = START_ROW; i < rows.length; i++) {
    const row     = rows[i];
    const csvName = row[nameIdx]?.trim();
    const stadt   = row[stadtIdx]?.trim();

    if (!csvName || !stadt) continue;

    // Optionally wipe stale coords so they get re-geocoded with the address
    if (REGEOCODE_ALL) { row[latIdx] = ''; row[lngIdx] = ''; }

    const alreadyScraped  = !!(row[kdIdx]?.trim() || row[addrIdx]?.trim());
    const alreadyGeocoded = !!(row[latIdx]?.trim() && row[lngIdx]?.trim());

    // Force re-scrape for cities listed in RESCRAPE env var
    const forceRescrape = RESCRAPE_CITIES.size > 0 && RESCRAPE_CITIES.has(stadt.toLowerCase());
    if (forceRescrape) {
      row[kdIdx] = ''; row[phoneIdx] = ''; row[faxIdx] = '';
      row[websiteIdx] = ''; row[addrIdx] = '';
      row[latIdx] = ''; row[lngIdx] = '';
      console.log(`\n[${i + 1}/${rows.length}] ↺  Force re-scrape: "${csvName}" (${stadt})`);
    }

    // ── Already fully done → skip entirely ───────────────────────────────────
    if (!forceRescrape && alreadyScraped && alreadyGeocoded) {
      skipped++;
      continue;
    }

    // ── Already scraped but missing coords → geocode-only pass (no BAMF) ─────
    if (!forceRescrape && alreadyScraped && !alreadyGeocoded) {
      console.log(`\n[${i + 1}/${rows.length}] 📍 Geocode-only: "${csvName}" (${stadt})`);
      const addr = row[addrIdx]?.trim() || null;
      const geo  = await geocode(addr, stadt);
      if (geo) { row[latIdx] = geo.lat; row[lngIdx] = geo.lng; }
      writeCSV(CSV_OUT, headers, rows);
      await sleep(DELAY_MS);
      continue;
    }

    // ── Full BAMF scrape (new entry or forced rescrape) ───────────────────────
    console.log(`\n[${i + 1}/${rows.length}] ${csvName}  —  searching "${stadt}"…`);

    const details = await scrapeDetails(page, csvName, stadt);
    processed++;

    if (details) {
      if (details.email)   row[kdIdx]      = details.email;
      if (details.phone)   row[phoneIdx]   = details.phone;
      if (details.fax)     row[faxIdx]     = details.fax;
      if (details.website) row[websiteIdx] = details.website;
      if (details.address) row[addrIdx]    = details.address;
      found++;
      console.log(`  ✓  email=${details.email ?? '—'}  phone=${details.phone ?? '—'}  fax=${details.fax ?? '—'}  web=${details.website ?? '—'}  addr=${details.address ?? '—'}`);
    } else {
      console.log('  –  No details found.');
    }

    // Geocode using the freshly scraped address
    if (!row[latIdx]?.trim() || !row[lngIdx]?.trim()) {
      const addr = row[addrIdx]?.trim() || null;
      const geo  = await geocode(addr, stadt);
      if (geo) { row[latIdx] = geo.lat; row[lngIdx] = geo.lng; }
      await sleep(1100);
    }

    // Save progress after every row so a crash doesn't lose work
    writeCSV(CSV_OUT, headers, rows);

    await sleep(DELAY_MS);
  }

  await browser.close();
  console.log(`\n═══════════════════════════════`);
  console.log(`Done.  Found: ${found}  /  Processed: ${processed}  /  Skipped (already filled): ${skipped}`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
