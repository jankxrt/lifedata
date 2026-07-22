"use client";
import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () =>
      setDark(
        document.documentElement.classList.contains("dark") ||
        (!document.documentElement.classList.contains("light") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", check);
    return () => { observer.disconnect(); mq.removeEventListener("change", check); };
  }, []);
  return dark;
}

const kontaktiertSet = new Set(["Y", "J", "YES", "JA"]);

const CSV_ALIASES: Record<string, string> = {
  "Neckar-Odenw.Kreis":         "Neckar-Odenwald-Kreis",
  "Kreis Neuss":                "Rhein-Kreis Neuss",
  "Alb-Donau-Kreis in Ehingen": "Alb-Donau-Kreis",
};
const GEO_ALIASES: Record<string, string> = {
  "Cleves":                  "Kleve",
  "Hanover":                 "Hannover",
  "Cologne Städte":          "Köln Städte",
  "Munich Städte":           "München Städte",
  "Nuremberg Städte":        "Nürnberg Städte",
  "Heilbronn city Städte":   "Heilbronn Städte",
};

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/\s*\(.*$/, "")
    .replace(/\s+in\s+\S.*$/i, "")
    .replace(/\s+städte$/i, "")
    .replace(/\bmittlerer\s+/gi, "")
    .replace(/-kreis\b/gi, "")
    .replace(/\bkreis\b/gi, "")
    .replace(/kreis$/gi, "")
    .replace(/[-.\s]+/g, " ")
    .trim();
}

export interface CsvRow {
  stadt: string;
  type: string;
  land: string;
  kontakt: string;
}

interface BundeslandStats { total: number; contacted: number }

interface TooltipInfo {
  name: string;
  detail?: string;
  color?: string;
  x: number;
  y: number;
}

interface Props {
  blStats: Record<string, BundeslandStats>;
  leadsByLand: Record<string, number>;
  csvRows: CsvRow[];
  selectedLand: string | null;
  onLandClick: (name: string) => void;
  onBack: () => void;
}

// ── GeoJSON layer controller ─────────────────────────────────────────────────
function Layers({
  blGeo, lkGeo, blStats, leadsByLand, lookup, selectedLand, onLandClick, dark,
  maxTotal, onTooltip,
}: {
  blGeo: GeoJSON.FeatureCollection | null;
  lkGeo: GeoJSON.FeatureCollection | null;
  blStats: Record<string, BundeslandStats>;
  leadsByLand: Record<string, number>;
  lookup: Map<string, CsvRow[]>;
  selectedLand: string | null;
  onLandClick: (name: string) => void;
  dark: boolean;
  maxTotal: number;
  onTooltip: (info: TooltipInfo | null) => void;
}) {
  const map = useMap();

  // Fit to selected Bundesland when it changes
  useEffect(() => {
    if (!selectedLand || !lkGeo) return;
    const features = lkGeo.features.filter(
      (f) => f.properties?.NAME_1 === selectedLand
    );
    if (features.length === 0) return;
    const bounds = L.geoJSON({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection).getBounds();
    map.fitBounds(bounds, { padding: [20, 20], duration: 0.8 });
  }, [selectedLand, lkGeo, map]);

  // Reset to Germany when deselecting
  useEffect(() => {
    if (!selectedLand) {
      map.flyTo([51.2, 10.4], 6, { duration: 0.8 });
    }
  }, [selectedLand, map]);

  const borderColor = dark ? "#4b5563" : "#9ca3af";

  const blStyle = useCallback((feature: GeoJSON.Feature | undefined): L.PathOptions => {
    const name = feature?.properties?.name as string;
    const s = blStats[name];
    if (!s) return { fillColor: dark ? "#374151" : "#e5e7eb", fillOpacity: 0.4, color: borderColor, weight: 0.8 };
    const opacity = 0.15 + (s.total / maxTotal) * 0.65;
    return { fillColor: "rgb(14,165,233)", fillOpacity: opacity, color: borderColor, weight: 0.8 };
  }, [blStats, maxTotal, dark, borderColor]);

  const lkStyle = useCallback((feature: GeoJSON.Feature | undefined): L.PathOptions => {
    const name3 = feature?.properties?.NAME_3 as string;
    const type3 = feature?.properties?.TYPE_3 as string;
    const resolved = GEO_ALIASES[name3] ?? name3;
    const matched = lookup.get(normName(resolved)) ?? [];
    const isStadt = type3 === "Kreisfreie Städte";
    const contacted = matched.some(r => kontaktiertSet.has(r.kontakt.trim().toUpperCase()));
    if (matched.length === 0) return { fillColor: dark ? "#4b5563" : "#94a3b8", fillOpacity: 0.18, color: borderColor, weight: 0.8 };
    const base = isStadt ? "rgb(139,92,246)" : "rgb(14,165,233)";
    return { fillColor: base, fillOpacity: contacted ? 0.70 : 0.26, color: borderColor, weight: 0.8 };
  }, [lookup, dark, borderColor]);

  const onEachBL = useCallback((feature: GeoJSON.Feature, layer: L.Layer) => {
    const name = feature.properties?.name as string;
    const pathLayer = layer as L.Path;
    layer.on({
      mouseover: (e: L.LeafletMouseEvent) => {
        pathLayer.setStyle({ fillOpacity: 0.85 });
        const s = blStats[name];
        const leads = leadsByLand[name];
        onTooltip({
          name,
          detail: [s ? `${s.total} ABHs` : null, leads ? `${leads} Leads` : null].filter(Boolean).join(" · "),
          x: e.containerPoint.x,
          y: e.containerPoint.y,
        });
      },
      mouseout: () => {
        pathLayer.setStyle(blStyle(feature));
        onTooltip(null);
      },
      click: () => onLandClick(name),
    });
  }, [blStats, leadsByLand, blStyle, onLandClick, onTooltip]);

  const onEachLK = useCallback((feature: GeoJSON.Feature, layer: L.Layer) => {
    const name3 = feature.properties?.NAME_3 as string;
    const type3 = feature.properties?.TYPE_3 as string;
    const resolved = GEO_ALIASES[name3] ?? name3;
    const matched = lookup.get(normName(resolved)) ?? [];
    const pathLayer = layer as L.Path;
    const isStadt = type3 === "Kreisfreie Städte";
    layer.on({
      mouseover: (e: L.LeafletMouseEvent) => {
        pathLayer.setStyle({ fillOpacity: 0.85, fillColor: isStadt ? "rgb(139,92,246)" : "rgb(14,165,233)" });
        const contacted = matched.some(r => kontaktiertSet.has(r.kontakt.trim().toUpperCase()));
        onTooltip({
          name: name3.replace(/ Städte$/, ""),
          detail: matched.length === 0 ? "Keine Daten" : contacted ? "Kontaktiert" : "Nicht kontaktiert",
          color: isStadt ? "rgb(139,92,246)" : "rgb(14,165,233)",
          x: e.containerPoint.x,
          y: e.containerPoint.y,
        });
      },
      mouseout: () => {
        pathLayer.setStyle(lkStyle(feature));
        onTooltip(null);
      },
    });
  }, [lookup, lkStyle, onTooltip]);

  const lkFeatures = lkGeo && selectedLand
    ? { ...lkGeo, features: lkGeo.features.filter(f => f.properties?.NAME_1 === selectedLand) }
    : null;

  return (
    <>
      {blGeo && !selectedLand && (
        <GeoJSON
          key={`bl-${dark}`}
          data={blGeo}
          style={blStyle}
          onEachFeature={onEachBL}
        />
      )}
      {lkFeatures && (
        <GeoJSON
          key={`lk-${selectedLand}-${dark}`}
          data={lkFeatures}
          style={lkStyle}
          onEachFeature={onEachLK}
        />
      )}
    </>
  );
}

// ── Main exported component ──────────────────────────────────────────────────
export default function StatisticsLeafletMap({
  blStats, leadsByLand, csvRows, selectedLand, onLandClick, onBack,
}: Props) {
  const dark = useDarkMode();
  const [blGeo, setBlGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [lkGeo, setLkGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const tileUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  useEffect(() => {
    fetch("/data/bundeslaender.geo.json").then(r => r.json()).then(setBlGeo);
  }, []);

  useEffect(() => {
    if (selectedLand && !lkGeo) {
      fetch("/data/landkreise.geo.json").then(r => r.json()).then(setLkGeo);
    }
  }, [selectedLand, lkGeo]);

  const lookup = new Map<string, CsvRow[]>();
  csvRows.forEach(row => {
    const resolved = CSV_ALIASES[row.stadt] ?? row.stadt;
    const key = normName(resolved);
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(row);
  });

  const maxTotal = Math.max(...Object.values(blStats).map(s => s.total), 1);

  return (
    <div className="relative w-full h-full" style={{ minHeight: 340 }}>
      <style>{`
        .stats-leaflet .leaflet-container { font-family: inherit; background: transparent; }
        .stats-leaflet .leaflet-control-zoom { display: none; }
        .stats-leaflet .leaflet-control-attribution { font-size: 9px; background: ${dark ? "rgba(20,20,20,0.7)" : "rgba(255,255,255,0.7)"} !important; color: ${dark ? "#666" : "#999"} !important; }
      `}</style>
      <div className="stats-leaflet absolute inset-0">
        <MapContainer
          center={[51.0, 10.4]}
          zoom={5}
          minZoom={5}
          maxZoom={12}
          maxBounds={[[44.0, 2.0], [56.5, 20.0]]}
          maxBoundsViscosity={0.85}
          zoomControl={false}
          scrollWheelZoom
          dragging
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            key={tileUrl}
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url={tileUrl}
            subdomains="abcd"
            maxZoom={13}
          />
          <Layers
            blGeo={blGeo}
            lkGeo={lkGeo}
            blStats={blStats}
            leadsByLand={leadsByLand}
            lookup={lookup}
            selectedLand={selectedLand}
            onLandClick={onLandClick}
            dark={dark}
            maxTotal={maxTotal}
            onTooltip={setTooltip}
          />
        </MapContainer>
      </div>

      {/* Back button overlay */}
      {selectedLand && (
        <button
          onClick={onBack}
          className="absolute top-2 left-2 z-[1000] inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)] hover:bg-[color:var(--surface-hover)] transition-colors shadow-sm"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Deutschland
        </button>
      )}

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-[1000] max-w-[200px] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-lg text-sm"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="font-semibold text-[color:var(--foreground)] leading-tight">{tooltip.name}</p>
          {tooltip.detail && (
            <p className="mt-0.5 text-xs" style={{ color: tooltip.color ?? "var(--muted)" }}>{tooltip.detail}</p>
          )}
        </div>
      )}
    </div>
  );
}
