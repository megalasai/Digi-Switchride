"use client";

import { useEffect, useRef, useState } from "react";
import type { Circle as LeafletCircle, Map as LeafletMap, Marker as LeafletMarker, Polyline as LeafletPolyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { resolveAssetKind, resolveMotion, vehicleMarkerSvg } from "@/lib/vehicleIcons";

import { api } from "@/lib/api";

const INDIA = { lat: 21.1458, lng: 79.0882 };
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

type SearchHit = { display_name: string; lat: string; lon: string };

function parseCoord(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function loadLeaflet() {
  const L = (await import("leaflet")).default;
  const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  return L;
}

export function LocationPicker({
  lat,
  lng,
  onChange,
  onAddress,
  optional = false,
}: {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
  onAddress?: (address: string) => void;
  optional?: boolean;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const onAddressRef = useRef(onAddress);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  onChangeRef.current = onChange;
  onAddressRef.current = onAddress;

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    const parsedLat = parseCoord(lat) ?? INDIA.lat;
    const parsedLng = parseCoord(lng) ?? INDIA.lng;
    const hasPoint = parseCoord(lat) != null && parseCoord(lng) != null;

    void (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;
      const map = L.map(mapEl.current, { scrollWheelZoom: true }).setView([parsedLat, parsedLng], hasPoint ? 15 : 12);
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      if (hasPoint) {
        markerRef.current = L.marker([parsedLat, parsedLng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current?.getLatLng();
          if (!pos) return;
          onChangeRef.current(pos.lat.toFixed(6), pos.lng.toFixed(6));
          void reverseGeocode(pos.lat, pos.lng, onAddressRef.current);
        });
      }
      map.on("click", (e) => {
        const { lat: nextLat, lng: nextLng } = e.latlng;
        if (!markerRef.current) {
          markerRef.current = L.marker([nextLat, nextLng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current?.getLatLng();
            if (!pos) return;
            onChangeRef.current(pos.lat.toFixed(6), pos.lng.toFixed(6));
            void reverseGeocode(pos.lat, pos.lng, onAddressRef.current);
          });
        } else {
          markerRef.current.setLatLng([nextLat, nextLng]);
        }
        onChangeRef.current(nextLat.toFixed(6), nextLng.toFixed(6));
        void reverseGeocode(nextLat, nextLng, onAddressRef.current);
      });
      mapRef.current = map;
      watchSize(mapEl.current, map);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map instance is created once; coordinate updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nextLat = parseCoord(lat);
    const nextLng = parseCoord(lng);
    const map = mapRef.current;
    if (!map || nextLat == null || nextLng == null) return;
    const current = markerRef.current?.getLatLng();
    if (current && Math.abs(current.lat - nextLat) < 0.000001 && Math.abs(current.lng - nextLng) < 0.000001) return;
    void (async () => {
      const L = await loadLeaflet();
      if (!markerRef.current) {
        markerRef.current = L.marker([nextLat, nextLng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current?.getLatLng();
          if (!pos) return;
          onChangeRef.current(pos.lat.toFixed(6), pos.lng.toFixed(6));
          void reverseGeocode(pos.lat, pos.lng, onAddressRef.current);
        });
      } else {
        markerRef.current.setLatLng([nextLat, nextLng]);
      }
      map.setView([nextLat, nextLng], Math.max(map.getZoom(), 14));
    })();
  }, [lat, lng]);

  const search = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    setSearchError("");
    try {
      const data = await api.geoSearch(query.trim());
      setHits(data);
      if (!data.length) setSearchError("No matching places. Try a fuller address.");
    } catch {
      setSearchError("Could not search OpenStreetMap right now.");
    } finally {
      setSearching(false);
    }
  };

  const applyHit = (hit: SearchHit) => {
    onChange(Number(hit.lat).toFixed(6), Number(hit.lon).toFixed(6));
    onAddress?.(hit.display_name);
    setHits([]);
    setQuery(hit.display_name);
  };

  return (
    <div className="md:col-span-2 space-y-3">
      <Field label="Find on OpenStreetMap" hint="Search a place, click the map, or type coordinates. Tiles: OpenStreetMap.">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search area, landmark or address"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={() => void search()} disabled={searching || query.trim().length < 3}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>
      </Field>
      {searchError && <p className="text-xs text-danger">{searchError}</p>}
      {hits.length > 0 && (
        <ul className="max-h-40 overflow-auto rounded-xl border border-border bg-white text-sm">
          {hits.map((hit) => (
            <li key={`${hit.lat}-${hit.lon}-${hit.display_name}`}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-brand-light" onClick={() => applyHit(hit)}>
                {hit.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={mapEl} className="z-0 h-72 w-full overflow-hidden rounded-xl border border-border" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Latitude" hint={optional ? "Optional" : undefined}>
          <Input type="number" step="any" required={!optional} value={lat} onChange={(e) => onChange(e.target.value, lng)} />
        </Field>
        <Field label="Longitude" hint={optional ? "Optional" : undefined}>
          <Input type="number" step="any" required={!optional} value={lng} onChange={(e) => onChange(lat, e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

export function LocationPreview({
  lat,
  lng,
  label,
  trail,
  place,
  wheelClass,
  vehicleType,
  alignToRoads = true,
  speedKmh,
  ignition,
  lastTelemetryAt,
  withRider,
  immobilised,
}: {
  lat?: number | null;
  lng?: number | null;
  label?: string;
  trail?: { lat: number; lng: number }[];
  place?: string | null;
  wheelClass?: string | null;
  vehicleType?: string | null;
  alignToRoads?: boolean;
  speedKmh?: number | null;
  ignition?: string | null;
  lastTelemetryAt?: string | Date | null;
  withRider?: boolean;
  immobilised?: boolean;
}) {
  const mapEl = useRef<HTMLDivElement>(null);

  const trailKey = (trail ?? []).map((p) => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (lat == null || lng == null || !mapEl.current) return;
    let map: LeafletMap | null = null;
    let cancelled = false;
    void (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;
      map = L.map(mapEl.current, { scrollWheelZoom: false }).setView([lat, lng], 16);
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      const raw = (trail ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      const path = alignToRoads ? await snapToRoads(raw) : raw;
      if (cancelled) return;
      if (path.length > 1) {
        L.polyline(
          path.map((p) => [p.lat, p.lng] as [number, number]),
          { color: "#0f6e56", weight: 5, opacity: 0.9 },
        ).addTo(map);
      }
      const heading = headingFromPath([...path, { lat, lng }]);
      const motion = resolveMotion({ speedKmh, ignition, lastTelemetryAt, immobilised });
      const icon = vehicleLeafletIcon(L, {
        type: vehicleType,
        wheelClass,
        heading,
        color: motion.color,
        withRider,
      });
      L.marker([lat, lng], { icon }).addTo(map).bindPopup(label ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      watchSize(mapEl.current, map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, label, trailKey, wheelClass, vehicleType, alignToRoads, speedKmh, ignition, lastTelemetryAt, withRider, immobilised]);

  if (lat == null || lng == null) {
    return <p className="text-xs text-text-muted">No coordinates to show on the map.</p>;
  }

  return (
    <div>
      <div ref={mapEl} className="z-0 h-56 w-full overflow-hidden rounded-xl border border-border" />
      <p className="mt-1 text-xs text-text-muted">
        {place ? `${place} · ` : ""}
        {lat.toFixed(5)}, {lng.toFixed(5)}
        {trail && trail.length > 1 ? ` · last ${trail.length} pings (~1 min)` : ""}
      </p>
    </div>
  );
}

export function LocationMarkersMap({
  points,
}: {
  points: { id: string; lat: number; lng: number; label: string }[];
}) {
  const mapEl = useRef<HTMLDivElement>(null);

  const signature = points.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.label}`).join("|");

  useEffect(() => {
    if (!mapEl.current) return;
    let map: LeafletMap | null = null;
    let cancelled = false;
    void (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;
      map = L.map(mapEl.current, { scrollWheelZoom: true });
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      if (points.length === 0) {
        map.setView([INDIA.lat, INDIA.lng], 5);
      } else {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
        points.forEach((p) => L.marker([p.lat, p.lng]).addTo(map!).bindPopup(p.label));
        map.fitBounds(bounds.pad(0.2));
      }
      watchSize(mapEl.current, map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return <div ref={mapEl} className="z-0 mb-6 h-72 w-full overflow-hidden rounded-2xl border border-border" />;
}

export function LiveVehicleMap({
  vehicles,
  onSelect,
  className,
  showTrail = true,
  alignToRoads = true,
  focusId,
  places = [],
  onMapClick,
  drawing = false,
  draft = null,
  focusPoint = null,
}: {
  vehicles: {
    id: string;
    lat: number;
    lng: number;
    label: string;
    trail?: { lat: number; lng: number }[];
    wheelClass?: string | null;
    vehicleType?: string | null;
    status?: string | null;
    speedKmh?: number | null;
    ignition?: string | null;
    lastTelemetryAt?: string | Date | null;
    withRider?: boolean;
    immobilised?: boolean;
  }[];
  onSelect?: (id: string) => void;
  className?: string;
  showTrail?: boolean;
  alignToRoads?: boolean;
  focusId?: string | null;
  places?: { id: string; kind: "geofence" | "poi"; name: string; lat: number; lng: number; radiusM?: number }[];
  onMapClick?: (lat: number, lng: number) => void;
  drawing?: boolean;
  draft?: { kind: "geofence" | "poi"; lat: number; lng: number; radiusM?: number } | null;
  focusPoint?: { lat: number; lng: number } | null;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const trailsRef = useRef<Map<string, LeafletPolyline>>(new Map());
  const placeLayersRef = useRef<Map<string, LeafletMarker | LeafletCircle>>(new Map());
  const draftLayerRef = useRef<LeafletMarker | LeafletCircle | null>(null);
  const fittedRef = useRef(false);
  const vehiclesRef = useRef(vehicles);
  const showTrailRef = useRef(showTrail);
  const alignToRoadsRef = useRef(alignToRoads);
  const onSelectRef = useRef(onSelect);
  const placesRef = useRef(places);
  const onMapClickRef = useRef(onMapClick);
  const drawingRef = useRef(drawing);
  vehiclesRef.current = vehicles;
  showTrailRef.current = showTrail;
  alignToRoadsRef.current = alignToRoads;
  onSelectRef.current = onSelect;
  placesRef.current = places;
  onMapClickRef.current = onMapClick;
  drawingRef.current = drawing;

  const signature = vehicles
    .map((v) => {
      const motion = resolveMotion(v);
      return `${v.id}:${v.lat.toFixed(5)}:${v.lng.toFixed(5)}:${(v.trail ?? []).length}:${v.vehicleType}:${v.wheelClass}:${motion.kind}:${v.withRider ? 1 : 0}:${showTrail}`;
    })
    .join("|");

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    void (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;
      const map = L.map(mapEl.current, { scrollWheelZoom: true }).setView([INDIA.lat, INDIA.lng], 5);
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      map.on("click", (event) => {
        if (!drawingRef.current) return;
        onMapClickRef.current?.(event.latlng.lat, event.latlng.lng);
      });
      mapRef.current = map;
      watchSize(mapEl.current, map);
      await syncLiveMarkers(L);
      syncPlaces(L);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      trailsRef.current.clear();
      placeLayersRef.current.clear();
      fittedRef.current = false;
    };
    // Map instance is created once per page load so polling does not reset zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      const L = await loadLeaflet();
      await syncLiveMarkers(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    void (async () => {
      const L = await loadLeaflet();
      syncPlaces(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.radiusM}:${p.name}:${p.kind}`).join("|")]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
    map.doubleClickZoom[drawing ? "disable" : "enable"]();
  }, [drawing]);

  useEffect(() => {
    void (async () => {
      const L = await loadLeaflet();
      const map = mapRef.current;
      if (!map) return;
      if (draftLayerRef.current) {
        map.removeLayer(draftLayerRef.current);
        draftLayerRef.current = null;
      }
      if (!draft || !Number.isFinite(draft.lat) || !Number.isFinite(draft.lng)) return;
      if (draft.kind === "geofence") {
        const circle = L.circle([draft.lat, draft.lng], {
          radius: draft.radiusM ?? 200,
          color: "#dc2626",
          weight: 3,
          fillOpacity: 0.18,
          dashArray: "6 4",
        }).addTo(map);
        draftLayerRef.current = circle;
      } else {
        const marker = L.circleMarker([draft.lat, draft.lng], {
          radius: 10,
          color: "#dc2626",
          fillColor: "#dc2626",
          fillOpacity: 1,
        }).addTo(map);
        draftLayerRef.current = marker as unknown as LeafletMarker;
      }
    })();
  }, [draft?.kind, draft?.lat, draft?.lng, draft?.radiusM]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.setView([focusPoint.lat, focusPoint.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [focusPoint?.lat, focusPoint?.lng]);

  async function syncLiveMarkers(L: Awaited<ReturnType<typeof loadLeaflet>>) {
    const map = mapRef.current;
    if (!map) return;
    const current = vehiclesRef.current;
    const show = showTrailRef.current;
    const align = alignToRoadsRef.current;
    const seen = new Set<string>();

    for (const v of current) {
      seen.add(v.id);
      const raw = show ? (v.trail ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) : [];
      const path = show && align ? await snapToRoads(raw) : raw;
      const heading = headingFromPath([...path, { lat: v.lat, lng: v.lng }]);
      const motion = resolveMotion(v);
      const withRider = Boolean(v.withRider || v.status === "InRide");
      const icon = vehicleLeafletIcon(L, {
        type: v.vehicleType,
        wheelClass: v.wheelClass,
        heading,
        color: motion.color,
        withRider,
      });
      let marker = markersRef.current.get(v.id);
      if (!marker) {
        marker = L.marker([v.lat, v.lng], { icon }).addTo(map);
        const vehicleId = v.id;
        marker.on("click", (event) => {
          const pos = marker?.getLatLng();
          if (drawingRef.current && pos) {
            event.originalEvent?.stopPropagation();
            onMapClickRef.current?.(pos.lat, pos.lng);
          }
          onSelectRef.current?.(vehicleId);
        });
        markersRef.current.set(v.id, marker);
      } else {
        marker.setLatLng([v.lat, v.lng]);
        marker.setIcon(icon);
      }
      marker.bindPopup(v.label);

      const previousTrail = trailsRef.current.get(v.id);
      if (previousTrail) {
        map.removeLayer(previousTrail);
        trailsRef.current.delete(v.id);
      }
      if (path.length > 1) {
        const line = L.polyline(
          path.map((p) => [p.lat, p.lng] as [number, number]),
          { color: motion.color, weight: 5, opacity: 0.88 },
        ).addTo(map);
        trailsRef.current.set(v.id, line);
      }
    }

    for (const [id, marker] of [...markersRef.current.entries()]) {
      if (seen.has(id)) continue;
      map.removeLayer(marker);
      markersRef.current.delete(id);
      const line = trailsRef.current.get(id);
      if (line) {
        map.removeLayer(line);
        trailsRef.current.delete(id);
      }
    }

    if (!fittedRef.current && current.length > 0) {
      const bounds = L.latLngBounds(current.map((v) => [v.lat, v.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25));
      fittedRef.current = true;
    }
  }

  function syncPlaces(L: Awaited<ReturnType<typeof loadLeaflet>>) {
    const map = mapRef.current;
    if (!map) return;
    const current = placesRef.current;
    const seen = new Set<string>();
    for (const place of current) {
      seen.add(place.id);
      const existing = placeLayersRef.current.get(place.id);
      if (existing) {
        map.removeLayer(existing);
        placeLayersRef.current.delete(place.id);
      }
      if (place.kind === "geofence") {
        const circle = L.circle([place.lat, place.lng], {
          radius: place.radiusM ?? 200,
          color: "#2563eb",
          weight: 2,
          fillOpacity: 0.12,
          interactive: !drawingRef.current,
        }).addTo(map);
        circle.bindPopup(place.name);
        placeLayersRef.current.set(place.id, circle);
      } else {
        const marker = L.circleMarker([place.lat, place.lng], {
          radius: 8,
          color: "#7c3aed",
          fillColor: "#7c3aed",
          fillOpacity: 0.9,
          interactive: !drawingRef.current,
        }).addTo(map);
        marker.bindPopup(place.name);
        placeLayersRef.current.set(place.id, marker as unknown as LeafletMarker);
      }
    }
    for (const [id, layer] of [...placeLayersRef.current.entries()]) {
      if (seen.has(id)) continue;
      map.removeLayer(layer);
      placeLayersRef.current.delete(id);
    }
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const hit = vehiclesRef.current.find((v) => v.id === focusId);
    if (!hit) return;
    map.setView([hit.lat, hit.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [focusId]);

  return (
    <div className={`relative isolate ${className ?? "z-0 mb-6 h-80 w-full overflow-hidden rounded-2xl border border-border"}`}>
      <div ref={mapEl} className="absolute inset-0 z-0 h-full w-full" />
    </div>
  );
}

function watchSize(el: HTMLElement | null, map: LeafletMap | null) {
  if (!el || !map) return;
  const redraw = () => map.invalidateSize();
  setTimeout(redraw, 80);
  setTimeout(redraw, 400);
  if (typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(redraw);
  ro.observe(el);
}

function headingFromPath(path: { lat: number; lng: number }[]) {
  if (path.length < 2) return 0;
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function downsample(points: { lat: number; lng: number }[], max = 24) {
  if (points.length <= max) return points;
  const out: { lat: number; lng: number }[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]);
  return out;
}

async function snapToRoads(path: { lat: number; lng: number }[]) {
  if (path.length < 2) return path;
  const pts = downsample(path);
  const coords = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!res.ok) return path;
    const data = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
    const line = data.routes?.[0]?.geometry?.coordinates;
    if (!line?.length) return path;
    return line.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return path;
  }
}

function vehicleLeafletIcon(
  L: Awaited<ReturnType<typeof loadLeaflet>>,
  opts: {
    type?: string | null;
    wheelClass?: string | null;
    heading: number;
    color: string;
    withRider?: boolean;
  },
) {
  const kind = resolveAssetKind(opts.type, opts.wheelClass);
  const svg = vehicleMarkerSvg(kind, opts.color, { withRider: opts.withRider, kind });
  const pip =
    opts.heading && Number.isFinite(opts.heading)
      ? `<span style="position:absolute;left:50%;top:-2px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid ${opts.color};transform:translateX(-50%) rotate(${opts.heading}deg);transform-origin:50% 22px"></span>`
      : "";
  return L.divIcon({
    className: "vehicle-map-icon",
    html: `<div style="position:relative;width:40px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">${pip}${svg}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -18],
  });
}

async function reverseGeocode(lat: number, lng: number, onAddress?: (address: string) => void) {
  if (!onAddress) return;
  try {
    const data = await api.geoReverse(lat, lng);
    if (data?.display_name) onAddress(data.display_name);
  } catch {
    /* location lookup is best-effort */
  }
}
