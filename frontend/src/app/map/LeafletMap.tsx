"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, Circle } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ABHEntry } from "@/lib/supabase";

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

const GERMANY_BOUNDS = L.latLngBounds([46.5, 5.5], [55.5, 15.5]);

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;background:rgb(124,58,237);border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -10],
});

const centerDotIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;background:rgb(124,58,237);border:2.5px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.4);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const edgeHandleIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;background:white;border:2.5px solid rgb(124,58,237);border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.3);cursor:grab;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 32 : count < 100 ? 38 : 44;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:rgb(124,58,237);color:white;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-family:inherit;">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function haversineKm(a: L.LatLng, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function BoundsFitter({ entries }: { entries: ABHEntry[] }) {
  const map = useMap();
  useEffect(() => {
    const geo = entries.filter(e => e.lat != null && e.lng != null);
    if (geo.length === 0) return;
    map.fitBounds(L.latLngBounds(geo.map(e => [e.lat!, e.lng!] as [number, number])), { padding: [40, 40] });
  }, [entries.length]);
  return null;
}

function FlyTo({ target }: { target: ABHEntry | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target || target.lat == null || target.lng == null) return;
    map.flyTo([target.lat, target.lng], 14, { duration: 1.2 });
  }, [target]);
  return null;
}

function SearchBar({ entries, dark }: { entries: ABHEntry[]; dark: boolean }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<ABHEntry[]>([]);
  const [open, setOpen]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const map = useMap();

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); setOpen(false); return; }
    const hits = entries.filter(e =>
      e.name.toLowerCase().includes(q) || e.stadt.toLowerCase().includes(q)
    ).slice(0, 8);
    setResults(hits);
    setOpen(hits.length > 0);
  }, [query, entries]);

  function choose(entry: ABHEntry) {
    setQuery(entry.stadt);
    setOpen(false);
    if (entry.lat != null && entry.lng != null)
      map.flyTo([entry.lat, entry.lng], 14, { duration: 1.2 });
  }

  const bg      = dark ? "#1f1f1f" : "#fff";
  const border  = dark ? "#3a3a3a" : "#e5e5e5";
  const text    = dark ? "#e5e5e5" : "#111";
  const muted   = dark ? "#888" : "#666";
  const hoverBg = dark ? "#2a2a2a" : "#f5f5f5";

  return (
    <div
      style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, width: 260 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: muted, pointerEvents: "none" }} width="15" height="15" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={e => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
            if (e.key === "Enter" && results.length > 0) choose(results[0]);
          }}
          placeholder="Stadt oder ABH suchen…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "9px 12px 9px 32px",
            borderRadius: open ? "10px 10px 0 0" : 10,
            border: `1px solid ${border}`,
            background: bg, color: text,
            fontSize: 13, outline: "none",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            fontFamily: "inherit",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: muted, padding: 2 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        )}
      </div>
      {open && (
        <div style={{ background: bg, border: `1px solid ${border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {results.map((entry, i) => (
            <div
              key={entry.stadt}
              onClick={() => choose(entry)}
              style={{ padding: "8px 12px", cursor: "pointer", borderTop: i > 0 ? `1px solid ${border}` : "none", background: bg, transition: "background 0.1s" }}
              onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = bg)}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: text }}>{entry.name}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>{entry.stadt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Radius layer (lives inside MapContainer so it can use useMap) ─────────────
function RadiusLayer({
  radiusKm,
  onCenterChange,
  onRadiusChange,
  onLiveKm,
  dark,
}: {
  radiusKm: number;
  onCenterChange: (c: L.LatLng | null) => void;
  onRadiusChange: (km: number) => void;
  onLiveKm: (km: number | null) => void;
  dark: boolean;
}) {
  const map = useMap();
  const [center, setCenter] = useState<L.LatLng | null>(null);
  const [waiting, setWaiting] = useState(true);
  // Live radius only during drag — keeps the circle animating without React fighting Leaflet's drag
  const [dragKm, setDragKm] = useState<number | null>(null);

  const displayKm = dragKm ?? radiusKm;

  // Crosshair cursor while waiting for a click
  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor = waiting ? "crosshair" : "";
    return () => { el.style.cursor = ""; };
  }, [waiting, map]);

  // Place center on first click
  useEffect(() => {
    if (!waiting) return;
    const handler = (e: L.LeafletMouseEvent) => {
      setCenter(e.latlng);
      setWaiting(false);
      onCenterChange(e.latlng);
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [waiting, map, onCenterChange]);

  // Edge handle: east of center by radiusKm
  const edgeLatLng = center ? L.latLng(
    center.lat,
    center.lng + radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180))
  ) : null;

  const handleDrag = useCallback((e: L.LeafletEvent) => {
    if (!center) return;
    const pos = (e.target as L.Marker).getLatLng();
    const km = Math.min(200, Math.max(1, Math.round(haversineKm(center, pos))));
    setDragKm(km);
    onLiveKm(km);
  }, [center, onLiveKm]);

  const handleDragEnd = useCallback((e: L.LeafletEvent) => {
    if (!center) return;
    const pos = (e.target as L.Marker).getLatLng();
    const km = Math.min(200, Math.max(1, Math.round(haversineKm(center, pos))));
    setDragKm(null);
    onLiveKm(null);
    onRadiusChange(km);
  }, [center, onLiveKm, onRadiusChange]);

  if (!center) return null;

  return (
    <>
      <Circle
        center={center}
        radius={displayKm * 1000}
        pathOptions={{
          color: "rgb(124,58,237)",
          fillColor: "rgb(124,58,237)",
          fillOpacity: 0.08,
          weight: 2,
          dashArray: "6 5",
        }}
      />
      <Marker position={center} icon={centerDotIcon} interactive={false} />
      {edgeLatLng && (
        <Marker
          position={edgeLatLng}
          icon={edgeHandleIcon}
          draggable
          eventHandlers={{ drag: handleDrag, dragend: handleDragEnd }}
        />
      )}
    </>
  );
}

// ── Radius slider panel (absolute overlay, outside Leaflet DOM) ───────────────
function RadiusPanel({
  center, radiusKm, onRadiusChange, dark,
}: {
  center: boolean;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  dark: boolean;
}) {
  const bg     = dark ? "#1f1f1f" : "#fff";
  const border = dark ? "#3a3a3a" : "#e5e5e5";
  const text   = dark ? "#e5e5e5" : "#111";
  const muted  = dark ? "#888" : "#666";

  return (
    <div
      style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        zIndex: 1000, background: bg, border: `1px solid ${border}`,
        borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        padding: "12px 16px", width: 260, fontFamily: "inherit",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {!center ? (
        <p style={{ margin: 0, fontSize: 13, color: muted, textAlign: "center" }}>
          Klicke auf die Karte, um den Mittelpunkt zu setzen.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: text }}>Radius</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "rgb(124,58,237)" }}>{radiusKm} km</span>
          </div>
          <input
            type="range" min={1} max={200} value={radiusKm}
            onChange={e => onRadiusChange(Number(e.target.value))}
            style={{ width: "100%", accentColor: "rgb(124,58,237)", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: muted, marginTop: 2 }}>
            <span>1 km</span><span>200 km</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LeafletMap({
  entries,
  radiusActive,
  onRadiusEntries,
}: {
  entries: ABHEntry[];
  radiusActive: boolean;
  onRadiusEntries: (e: ABHEntry[] | null) => void;
}) {
  const dark = useDarkMode();
  const [germanyGeo, setGermanyGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [flyTarget]                 = useState<ABHEntry | null>(null);
  const [radiusCenter, setRadiusCenter] = useState<L.LatLng | null>(null);
  const [radiusKm, setRadiusKm]         = useState(10);
  const [liveKm, setLiveKm]             = useState<number | null>(null);
  const effectiveKm = liveKm ?? radiusKm;

  const tileUrl     = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  const borderColor = dark ? "#4b5563" : "#9ca3af";

  useEffect(() => {
    fetch("/data/bundeslaender.geo.json").then(r => r.json()).then(setGermanyGeo);
  }, []);

  // Reset when radius mode is turned off from the page
  useEffect(() => {
    if (!radiusActive) {
      setRadiusCenter(null);
      setRadiusKm(10);
      setLiveKm(null);
      onRadiusEntries(null);
    }
  }, [radiusActive]);

  // Recompute filtered entries whenever center or effective radius changes
  useEffect(() => {
    if (!radiusActive || !radiusCenter) return;
    const filtered = entries.filter(e =>
      e.lat != null && e.lng != null &&
      haversineKm(radiusCenter, { lat: e.lat, lng: e.lng }) <= effectiveKm
    );
    onRadiusEntries(filtered);
  }, [radiusActive, radiusCenter, effectiveKm, entries]);

  const geoEntries = entries.filter(e => e.lat != null && e.lng != null);
  const visibleEntries = radiusActive && radiusCenter
    ? geoEntries.filter(e => haversineKm(radiusCenter, { lat: e.lat!, lng: e.lng! }) <= effectiveKm)
    : geoEntries;

  return (
    <>
      <style>{`
        .leaflet-container { font-family: inherit; }
        .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0,0,0,${dark ? "0.4" : "0.12"});
          border: 1px solid ${dark ? "#333" : "#e5e5e5"};
          background: ${dark ? "#1f1f1f" : "#fff"};
          padding: 0;
        }
        .leaflet-popup-content { margin: 12px 14px; font-size: 13px; line-height: 1.5; color: ${dark ? "#e5e5e5" : "#111"}; }
        .leaflet-popup-tip-container { display: none; }
        .leaflet-control-attribution { font-size: 10px; background: ${dark ? "rgba(20,20,20,0.8)" : "rgba(255,255,255,0.8)"} !important; color: ${dark ? "#888" : "#333"} !important; }
        .leaflet-bar a { color: ${dark ? "#ccc" : "#333"} !important; border-bottom: 1px solid ${dark ? "#333" : "#e5e5e5"} !important; background: ${dark ? "#1f1f1f" : "#fff"} !important; }
        .leaflet-bar a:hover { background: ${dark ? "#2a2a2a" : "#f5f5f5"} !important; }
        .leaflet-bar { border-radius: 8px !important; box-shadow: 0 2px 8px rgba(0,0,0,${dark ? "0.4" : "0.12"}) !important; border: 1px solid ${dark ? "#333" : "#e5e5e5"} !important; }
      `}</style>

      <MapContainer
        center={[51.2, 10.4]}
        zoom={6}
        minZoom={6}
        maxZoom={18}
        maxBounds={GERMANY_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          key={tileUrl}
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={tileUrl}
          subdomains="abcd"
          maxZoom={19}
        />

        {germanyGeo && (
          <GeoJSON
            key={`borders-${dark}`}
            data={germanyGeo}
            style={{ color: borderColor, weight: 1, fillOpacity: 0 }}
          />
        )}

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={50}
          showCoverageOnHover={false}
        >
          {visibleEntries.map((entry) => (
            <Marker key={entry.id} position={[entry.lat!, entry.lng!] as [number, number]} icon={pinIcon}>
              <Popup>
                <strong style={{ fontSize: 13 }}>{entry.name}</strong>
                <div style={{ color: dark ? "#aaa" : "#666", marginTop: 2 }}>{entry.stadt}</div>
                {entry.adresse && (
                  <div style={{ color: dark ? "#777" : "#999", fontSize: 11, marginTop: 2 }}>{entry.adresse}</div>
                )}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {!radiusActive && <BoundsFitter entries={geoEntries} />}
        <FlyTo target={flyTarget} />
        <SearchBar entries={entries} dark={dark} />

        {radiusActive && (
          <RadiusLayer
            key="radius"
            radiusKm={radiusKm}
            onCenterChange={setRadiusCenter}
            onRadiusChange={setRadiusKm}
            onLiveKm={setLiveKm}
            dark={dark}
          />
        )}
      </MapContainer>

      {radiusActive && (
        <RadiusPanel
          center={!!radiusCenter}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          dark={dark}
        />
      )}
    </>
  );
}
