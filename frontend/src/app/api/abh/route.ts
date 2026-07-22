import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CSV_PATH = path.join(process.cwd(), 'public', 'data', 'abs_bundesland.csv');

function splitLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
    else { cur += ch; }
  }
  fields.push(cur);
  return fields;
}

function quoteField(val: string): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function readCSV() {
  let text = fs.readFileSync(CSV_PATH, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function writeCSV(headers: string[], rows: string[][]) {
  const content = '﻿' + [
    headers.map(quoteField).join(','),
    ...rows.map(r => r.map(quoteField).join(',')),
  ].join('\n');
  fs.writeFileSync(CSV_PATH, content, 'utf8');
}

// POST — insert new row
export async function POST(req: NextRequest) {
  try {
    const body: Record<string, string> = await req.json();
    const { headers, rows } = readCSV();
    const stadtIdx = headers.findIndex(h => h.trim() === 'Stadt');
    if (stadtIdx >= 0 && rows.some(r => r[stadtIdx]?.trim().toLowerCase() === body['Stadt']?.trim().toLowerCase())) {
      return NextResponse.json({ error: 'Stadt existiert bereits.' }, { status: 409 });
    }
    const newRow = headers.map(h => body[h.trim()] ?? '');
    // ensure row is at least as long as headers
    while (newRow.length < headers.length) newRow.push('');
    rows.push(newRow);
    writeCSV(headers, rows);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT — update existing row matched by Stadt
export async function PUT(req: NextRequest) {
  try {
    const { stadt, fields }: { stadt: string; fields: Record<string, string> } = await req.json();
    const { headers, rows } = readCSV();
    const stadtIdx = headers.findIndex(h => h.trim() === 'Stadt');
    const rowIdx = rows.findIndex(r => r[stadtIdx]?.trim().toLowerCase() === stadt.trim().toLowerCase());
    if (rowIdx < 0) return NextResponse.json({ error: 'Zeile nicht gefunden.' }, { status: 404 });
    Object.entries(fields).forEach(([key, val]) => {
      const colIdx = headers.findIndex(h => h.trim() === key);
      if (colIdx >= 0) {
        while (rows[rowIdx].length <= colIdx) rows[rowIdx].push('');
        rows[rowIdx][colIdx] = val ?? '';
      }
    });
    writeCSV(headers, rows);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
