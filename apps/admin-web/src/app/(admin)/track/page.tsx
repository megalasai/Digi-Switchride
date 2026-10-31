"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LiveVehicleMap } from "@/components/ui/LocationMap";
import { ImmobiliseButton, immobiliserHint } from "@/components/ImmobiliseButton";
import { ACCESS, canAccess } from "@/lib/access";
import { api, TrackPoint, TrackVehicle } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { assetTypeLabel, FleetMotionLegend, resolveMotion, VehicleGlyph } from "@/lib/vehicleIcons";

type Mode = "live" | "history";

function fmtTime(value?: string | Date | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function defaultFrom() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function defaultTo() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function TrackVehiclePage() {
  const { user } = useAuth();
  const canCommand = canAccess(user?.role, ACCESS.vehiclesWrite) || canAccess(user?.role, ["CommandCenter"]);
  const [vehicles, setVehicles] = useState<TrackVehicle[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("live");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [history, setHistory] = useState<TrackPoint[]>([]);
  const [playIndex, setPlayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const load = () => {
    api
      .trackVehicles()
      .then((r) => {
        setVehicles(r.items);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load fleet"));
  };

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (mode === "live") load();
    }, 8000);
    return () => clearInterval(t);
  }, [mode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.registrationNumber, v.model, v.type, v.lastPlace, v.iotDeviceId, v.vendorType]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [vehicles, search]);

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const located = filtered.filter((v) => v.lastLat != null && v.lastLng != null);

  const playbackPoint = history[playIndex];
  const mapVehicles =
    mode === "history" && selected && playbackPoint
      ? [
          {
            id: selected.id,
            lat: playbackPoint.lat,
            lng: playbackPoint.lng,
            label: `${selected.registrationNumber}<br/>Playback ${playIndex + 1}/${history.length}`,
            trail: history.slice(0, playIndex + 1),
            vehicleType: selected.type,
            wheelClass: selected.wheelClass,
            status: selected.status,
            speedKmh: playbackPoint.speedKmh,
            ignition: playbackPoint.ignition,
            lastTelemetryAt: playbackPoint.at,
            withRider: selected.status === "InRide" || Boolean(selected.assignedRiderId),
            immobilised: selected.immobilised,
          },
        ]
      : located.map((v) => {
          const motion = resolveMotion(v);
          const withRider = v.status === "InRide" || Boolean(v.assignedRiderId);
          return {
            id: v.id,
            lat: v.lastLat as number,
            lng: v.lastLng as number,
            label: `${v.registrationNumber}<br/>${assetTypeLabel(v.type, v.wheelClass)} · ${motion.label}${withRider ? " · On trip" : ""}${v.immobilised ? " · Immobilised" : ""}<br/>${v.lastPlace ?? ""}`,
            trail: v.id === selectedId ? (v.locationTrail ?? []) : [],
            vehicleType: v.type,
            wheelClass: v.wheelClass,
            status: v.status,
            speedKmh: v.speedKmh,
            ignition: v.ignition,
            lastTelemetryAt: v.lastTelemetryAt,
            withRider,
            immobilised: v.immobilised,
          };
        });

  useEffect(() => {
    if (!playing || mode !== "history" || history.length < 2) return;
    const t = setInterval(() => {
      setPlayIndex((i) => (i + 1 >= history.length ? 0 : i + 1));
    }, 700);
    return () => clearInterval(t);
  }, [playing, mode, history.length]);

  const loadHistory = async (vehicleId: string) => {
    setLoadingHistory(true);
    setPlaying(false);
    try {
      const result = await api.vehicleTrackHistory(vehicleId, new Date(from).toISOString(), new Date(to).toISOString());
      setHistory(result.points);
      setPlayIndex(0);
      if (!result.points.length) setError("No history in this period. Live pings from the last minute still appear on Live.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "History failed");
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] min-h-[640px] overflow-hidden bg-[#eef1f6] lg:-m-8">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">Fleet</p>
          <h1 className="mt-1 text-lg font-semibold text-text-primary">Track Vehicle</h1>
          <Input
            className="mt-3"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search registration, IMEI, place…"
          />
          <p className="mt-2 text-xs text-text-muted">{filtered.length} vehicles · {located.length} with GPS</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((v) => {
            const active = v.id === selectedId;
            const online = v.connectionStatus === "Connected" || (v.lastTelemetryAt && Date.now() - new Date(v.lastTelemetryAt).getTime() < 5 * 60 * 1000);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setSelectedId(v.id);
                  setMode("live");
                  setPlaying(false);
                }}
                className={`w-full border-b border-border px-4 py-3 text-left transition ${active ? "bg-brand-light" : "hover:bg-surface"}`}
              >
                <div className="flex items-center gap-2">
                  <VehicleGlyph
                    type={v.type}
                    wheelClass={v.wheelClass}
                    color={resolveMotion(v).color}
                    withRider={v.status === "InRide" || Boolean(v.assignedRiderId)}
                    className="inline-flex h-8 w-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-text-primary">{v.registrationNumber}</p>
                      <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-slate-300"}`} />
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {assetTypeLabel(v.type, v.wheelClass)} · {resolveMotion(v).label}
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge status={v.status} />
                  {v.immobilised ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Immobilised</span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-text-muted">{v.lastPlace ?? (v.lastLat != null ? `${v.lastLat.toFixed(4)}, ${v.lastLng?.toFixed(4)}` : "Waiting for GPS")}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="relative min-w-0 flex-1">
        <LiveVehicleMap
          className="z-0 h-full w-full rounded-none border-0"
          showTrail={mode === "history" || Boolean(selectedId)}
          alignToRoads={mode === "history"}
          focusId={mode === "live" ? selectedId : null}
          vehicles={mapVehicles}
          onSelect={(id) => {
            setSelectedId(id);
            setMode("live");
          }}
        />

        <div className="absolute left-4 top-4 z-[400] flex flex-wrap items-center gap-2">
          <Button type="button" variant={mode === "live" ? "primary" : "secondary"} onClick={() => { setMode("live"); setPlaying(false); }}>
            Live
          </Button>
          <Button
            type="button"
            variant={mode === "history" ? "primary" : "secondary"}
            disabled={!selectedId}
            onClick={() => {
              if (!selectedId) return;
              setMode("history");
              void loadHistory(selectedId);
            }}
          >
            History playback
          </Button>
          <div className="rounded-full border border-border bg-white/95 px-3 py-1.5 shadow-sm">
            <FleetMotionLegend className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted" />
          </div>
        </div>

        {error && (
          <div className="absolute left-4 right-4 top-16 z-[400] max-w-xl">
            <Alert message={error} />
          </div>
        )}
        {success && (
          <div className="absolute left-4 right-4 top-16 z-[400] max-w-xl">
            <Alert variant="success" message={success} />
          </div>
        )}

        {selected && (
          <div className="absolute bottom-4 left-4 right-4 z-[400] rounded-2xl border border-border bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">{selected.registrationNumber}</p>
                <p className="text-xs text-text-muted">
                  {assetTypeLabel(selected.type, selected.wheelClass)} · {selected.vendorType ?? "Unlinked"} · {selected.lastPlace ?? "No place yet"}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-secondary">
                  <span>Speed {selected.speedKmh != null ? `${Math.round(selected.speedKmh)} km/h` : "—"}</span>
                  <span>Odo {selected.odometerKm != null ? `${Math.round(selected.odometerKm)} km` : "—"}</span>
                  <span>Ign {selected.ignition ?? "—"}</span>
                  <span>Last {fmtTime(selected.lastTelemetryAt)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canCommand && (
                  <ImmobiliseButton
                    vehicleId={selected.id}
                    immobilised={selected.immobilised}
                    vendorType={selected.vendorType}
                    iotDeviceId={selected.iotDeviceId}
                    onDone={(msg) => {
                      setSuccess(msg);
                      load();
                    }}
                    onError={setError}
                  />
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-text-muted">{immobiliserHint(selected.vendorType)}</p>

            {mode === "history" && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="text-xs text-text-muted">
                  From
                  <Input type="datetime-local" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="text-xs text-text-muted">
                  To
                  <Input type="datetime-local" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
                <Button type="button" variant="secondary" disabled={loadingHistory} onClick={() => selectedId && void loadHistory(selectedId)}>
                  {loadingHistory ? "Loading…" : "Load route"}
                </Button>
                {history.length > 1 && (
                  <div className="md:col-span-3 flex items-center gap-3">
                    <Button type="button" variant="secondary" onClick={() => setPlaying((p) => !p)}>
                      {playing ? "Pause" : "Play"}
                    </Button>
                    <input
                      type="range"
                      className="w-full"
                      min={0}
                      max={history.length - 1}
                      value={playIndex}
                      onChange={(e) => {
                        setPlaying(false);
                        setPlayIndex(Number(e.target.value));
                      }}
                    />
                    <span className="shrink-0 text-xs text-text-muted">
                      {playIndex + 1}/{history.length} · {fmtTime(history[playIndex]?.at)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
