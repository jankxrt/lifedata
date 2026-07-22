"use client";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

const BL_GEO_URL = "/data/bundeslaender.geo.json";

interface ABHEntry {
  name: string;
  stadt: string;
  adresse: string;
  coordinates: [number, number] | null;
}

interface TooltipState {
  x: number;
  y: number;
  entry: ABHEntry;
}

async function geocodeCity(city: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Deutschland")}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, { headers: { "Accept-Language": "de" } });
    const data = await res.json();
    if (data && data[0]) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }
  } catch {
    // ignore geocoding errors
  }
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function MapPage() {
  const [entries, setEntries] = useState<ABHEntry[]>([]);
  const [geocoded, setGeocoded] = useState(0);
  const [total, setTotal] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Papa.parse<string[]>("/data/abs_bundesland.csv", {
      download: true,
      skipEmptyLines: true,
      encoding: "ISO-8859-1",
      complete: async (result) => {
        const [headers, ...rows] = result.data;
        const nameIdx = headers.findIndex((h: string) => h.trim() === "Name");
        const stadtIdx = headers.findIndex((h: string) => h.trim() === "Stadt");
        const addrIdx = headers.findIndex((h: string) => h.trim() === "Adresse");

        if (nameIdx < 0 || stadtIdx < 0) return;

        // Deduplicate by Stadt
        const seen = new Map<string, ABHEntry>();
        for (const row of rows) {
          const name = row[nameIdx]?.trim() ?? "";
          const stadt = row[stadtIdx]?.trim() ?? "";
          const adresse = addrIdx >= 0 ? row[addrIdx]?.trim() ?? "" : "";
          if (!stadt || seen.has(stadt)) continue;
          seen.set(stadt, { name, stadt, adresse, coordinates: null });
        }

        const list = Array.from(seen.values());
        setTotal(list.length);
        setEntries(list.map(e => ({ ...e })));

        // Geocode in batches with 1-second delay between requests (Nominatim TOS)
        for (let i = 0; i < list.length; i++) {
          const coords = await geocodeCity(list[i].stadt);
          list[i] = { ...list[i], coordinates: coords };
          setEntries([...list]);
          setGeocoded(i + 1);
          if (i < list.length - 1) await sleep(1100);
        }
      },
      error: () => {},
    });
  }, []);

  const ready = entries.filter(e => e.coordinates !== null);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Karte</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Ausländerbehörden auf der Karte.{" "}
            {total > 0 && geocoded < total && (
              <span>Geokodierung: {geocoded} / {total}…</span>
            )}
            {total > 0 && geocoded >= total && (
              <span>{ready.length} Standorte angezeigt.</span>
            )}
          </p>
        </header>

        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm"
          style={{ height: 600 }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [10.4, 51.2], scale: 2800 }}
            width={800}
            height={600}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup>
              <Geographies geography={BL_GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: { fill: "var(--surface-muted)", stroke: "var(--border)", strokeWidth: 0.5, outline: "none" },
                        hover:   { fill: "var(--surface-hover)", stroke: "var(--border)", strokeWidth: 0.5, outline: "none" },
                        pressed: { fill: "var(--surface-hover)", stroke: "var(--border)", strokeWidth: 0.5, outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {ready.map((entry) => (
                <Marker
                  key={entry.stadt}
                  coordinates={entry.coordinates!}
                  onClick={() => setTooltip(prev => prev?.entry.stadt === entry.stadt ? null : { x: 0, y: 0, entry })}
                >
                  <circle
                    r={5}
                    fill="rgb(124,58,237)"
                    fillOpacity={0.85}
                    stroke="white"
                    strokeWidth={1.2}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          entry,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                </Marker>
              ))}
            </ZoomableGroup>
          </ComposableMap>

          {tooltip && (
            <div
              className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-lg text-sm"
              style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
            >
              <p className="font-semibold text-[color:var(--foreground)] leading-tight">{tooltip.entry.name}</p>
              <p className="mt-0.5 text-[color:var(--muted)]">{tooltip.entry.stadt}</p>
              {tooltip.entry.adresse && (
                <p className="mt-0.5 text-xs text-[color:var(--muted)]">{tooltip.entry.adresse}</p>
              )}
            </div>
          )}
        </div>

        {ready.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm text-[color:var(--muted-strong)]">
                <thead>
                  <tr className="bg-[color:var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[color:var(--muted)]">
                    <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold">Name</th>
                    <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold">Stadt</th>
                    <th className="border-b border-[color:var(--border)] px-4 py-3 font-semibold">Adresse</th>
                  </tr>
                </thead>
                <tbody>
                  {ready.map((entry) => (
                    <tr key={entry.stadt} className="hover:bg-[color:var(--surface-hover)]">
                      <td className="border-b border-[color:var(--border)] px-4 py-2.5">{entry.name}</td>
                      <td className="border-b border-[color:var(--border)] px-4 py-2.5">{entry.stadt}</td>
                      <td className="border-b border-[color:var(--border)] px-4 py-2.5 text-xs font-mono">{entry.adresse || "—"}</td>
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
