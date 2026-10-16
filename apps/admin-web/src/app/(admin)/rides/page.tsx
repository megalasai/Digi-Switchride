"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveVehicleMap } from "@/components/ui/LocationMap";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconActivity } from "@/components/icons";
import { api, Ride } from "@/lib/api";

export default function ActiveRidesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-secondary">Loading active rides…</p>}>
      <ActiveRidesView />
    </Suspense>
  );
}

function ActiveRidesView() {
  const searchParams = useSearchParams();
  const focusRide = searchParams.get("ride");
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    const load = () => api.activeRides().then((r) => setRides(r.items)).catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const selected = useMemo(
    () => rides.find((r) => r.id === focusRide) ?? rides[0],
    [rides, focusRide],
  );

  const mapped = rides.filter((r) => r.lastLocation);

  return (
    <div>
      <PageHeader
        title="Active Rides"
        description="Live map of assigned vehicles. Ride cards show telemetry parameters instead of a second map."
      />
      {rides.length === 0 ? (
        <EmptyState
          icon={<IconActivity className="h-7 w-7" />}
          title="No active rides"
          description="Rides in progress will appear here with vehicle, customer and live location."
        />
      ) : (
        <>
          <LiveVehicleMap
            vehicles={mapped.map((ride) => ({
              id: ride.id,
              lat: ride.lastLocation!.lat,
              lng: ride.lastLocation!.lng,
              label: `${ride.vehicleRegistration ?? ride.vehicleId}<br/>${ride.customerName ?? "Customer"}<br/>${ride.lastPlace ?? "Locating…"}`,
              trail: ride.locationTrail,
              vehicleType: ride.vehicleType,
              wheelClass: ride.wheelClass,
              status: "InRide",
            }))}
            onSelect={(id) => {
              document.getElementById(`ride-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
          <div className="space-y-4">
            {rides.map((ride) => {
              const focused = selected?.id === ride.id;
              return (
                <Card
                  key={ride.id}
                  id={`ride-${ride.id}`}
                  className={`flex flex-col gap-4 p-5 lg:flex-row ${focused ? "ring-2 ring-brand" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text-primary">
                        {ride.vehicleRegistration ?? `Vehicle ${ride.vehicleId.slice(0, 8)}…`}
                      </p>
                      <Badge status="Active" />
                    </div>
                    <p className="text-sm text-text-secondary">
                      {ride.customerName ?? "Customer"}
                      {ride.customerPhone ? ` · ${ride.customerPhone}` : ""}
                    </p>
                    <p className="text-sm text-text-muted">
                      {ride.lastPlace ?? "Waiting for Digi-Switchride location lookup"}
                      {ride.lastPlaceKind === "Hub" ? " (inside hub)" : ride.lastPlaceKind === "Location" ? " (outside hub)" : ""}
                    </p>
                    <p className="text-sm text-text-muted">
                      Started {ride.startedAt ? new Date(ride.startedAt).toLocaleString() : "—"}
                    </p>
                    <Link className="mt-2 inline-block text-sm font-semibold text-brand" href={`/vehicles/${ride.vehicleId}`}>
                      Open vehicle
                    </Link>
                  </div>
                  <div className="w-full shrink-0 lg:w-80">
                    <VehicleParameterPanel ride={ride} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function VehicleParameterPanel({ ride }: { ride: Ride }) {
  const gps =
    ride.lastLocation != null
      ? `${ride.lastLocation.lat.toFixed(5)}, ${ride.lastLocation.lng.toFixed(5)}`
      : "No GPS yet";
  const rows: { label: string; value: string }[] = [
    { label: "Model", value: ride.model ?? ride.vehicleType ?? "—" },
    { label: "Class", value: ride.wheelClass ?? "—" },
    { label: "Status", value: ride.vehicleStatus ?? ride.status },
    { label: "Battery", value: ride.batteryPercent != null ? `${ride.batteryPercent}%` : "—" },
    { label: "Speed", value: ride.speedKmh != null ? `${ride.speedKmh} km/h` : "—" },
    { label: "Ignition", value: ride.ignition ? ride.ignition : "—" },
    { label: "Odometer", value: ride.odometerKm != null ? `${ride.odometerKm} km` : "—" },
    { label: "GPS", value: gps },
    { label: "Last ping", value: ride.lastTelemetryAt ? new Date(ride.lastTelemetryAt).toLocaleTimeString() : "—" },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Vehicle parameters</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-text-muted">{row.label}</dt>
            <dd className="font-medium text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
