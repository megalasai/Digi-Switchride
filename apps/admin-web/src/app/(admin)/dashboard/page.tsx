"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ComingSoonBadge } from "@/components/ui/Provision";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveVehicleMap } from "@/components/ui/LocationMap";
import { IconDashboard } from "@/components/icons";
import { api, DashboardSnapshot } from "@/lib/api";

function money(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .dashboard()
        .then((snapshot) => {
          if (!cancelled) {
            setData(snapshot);
            setError("");
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Management Dashboard" description="Loading operational KPIs…" />
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Management Dashboard" description="Key operational and financial indicators" />
        <Alert message={error} />
      </div>
    );
  }

  if (!data) return null;

  const fleet = data.locatedVehicles ?? [];
  const located = fleet.filter((v) => v.lastLocation);

  return (
    <div>
      <PageHeader
        title="Management Dashboard"
        description="Live rider, fleet, KYC, payments, breakdowns, service and charging stations. All GPS-located vehicles refresh every 10 seconds."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total riders" value={data.riders.total} accent="slate" icon={<span>👥</span>} />
        <StatCard label="Active riders" value={data.riders.active} accent="brand" icon={<span>✓</span>} />
        <StatCard label="Inactive riders" value={data.riders.inactive} accent="amber" icon={<span>⏸</span>} />
        <StatCard label="Vehicles" value={data.vehicles.total} accent="blue" icon={<span>🛵</span>} />
        <StatCard label="Available" value={data.vehicles.byStatus.Available ?? 0} accent="brand" icon={<span>✓</span>} />
        <Link href="/rides" className="block">
          <StatCard label="In ride / reserved" value={(data.vehicles.byStatus.InRide ?? 0) + (data.vehicles.byStatus.Reserved ?? 0)} accent="amber" icon={<span>⚡</span>} />
        </Link>
        <StatCard label="Outstanding payments" value={`${data.outstandingPayments.count} · ${money(data.outstandingPayments.amount)}`} accent="amber" icon={<span>₹</span>} />
        <StatCard label="KYC approved" value={data.kyc.Approved ?? 0} accent="brand" icon={<span>🛡</span>} />
        <StatCard label="Rides (30d)" value={data.last30Days.totalRides} accent="blue" icon={<span>📅</span>} />
        <StatCard label="Revenue (30d)" value={money(data.last30Days.totalRevenue)} accent="blue" icon={<span>₹</span>} />
        <StatCard label="Open service requests" value={data.upcomingModules.serviceRequests.count} accent="blue" icon={<span>🔧</span>} />
        <StatCard label="Open breakdowns" value={data.upcomingModules.breakdownAlerts.count} accent="amber" icon={<span>⚠</span>} />
        <StatCard label="Charging stations" value={data.upcomingModules.chargingStations.count} accent="brand" icon={<span>⚡</span>} />
      </div>

      <Card className="mt-8 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">All located vehicles</h3>
            <p className="text-xs text-text-muted">Every vehicle with a GPS ping. Markers move on refresh without resetting zoom. Click an in-ride vehicle to open Active Rides.</p>
          </div>
          <Link className="text-sm font-semibold text-brand" href="/rides">Open active rides</Link>
        </div>
        {fleet.length === 0 ? (
          <EmptyState
            icon={<IconDashboard className="h-7 w-7" />}
            title="No GPS locations yet"
            description="Vehicles appear here as soon as telemetry reports a coordinate."
          />
        ) : (
          <>
            {located.length > 0 ? (
            <LiveVehicleMap
              showTrail={false}
              alignToRoads={false}
              vehicles={located.map((v) => ({
                id: v.rideId ?? v.id,
                lat: v.lastLocation!.lat,
                lng: v.lastLocation!.lng,
                label: `${v.registrationNumber}<br/>${v.status ?? ""}<br/>${v.lastPlace ?? "Locating…"}`,
                vehicleType: v.type,
                wheelClass: v.wheelClass,
                status: v.status,
              }))}
              onSelect={(id) => {
                const hit = located.find((v) => (v.rideId ?? v.id) === id);
                if (hit?.rideId) router.push(`/rides?ride=${hit.rideId}`);
                else if (hit) router.push(`/vehicles/${hit.id}`);
              }}
            />
            ) : (
              <p className="mb-4 text-sm text-text-muted">IoT vehicles are listed below. Map markers appear when Track360 sends coordinates.</p>
            )}
            <DataTable>
              <Table>
                <TableHead>
                  <TableHeaderCell>Vehicle</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Location</TableHeaderCell>
                  <TableHeaderCell>Class</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {fleet.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Link
                          className="font-semibold text-brand"
                          href={v.rideId ? `/rides?ride=${v.rideId}` : `/vehicles/${v.id}`}
                        >
                          {v.registrationNumber}
                        </Link>
                      </TableCell>
                      <TableCell><Badge status={v.status ?? ""} /></TableCell>
                      <TableCell>
                        {v.lastPlace ?? (v.lastLocation ? `${v.lastLocation.lat.toFixed(4)}, ${v.lastLocation.lng.toFixed(4)}` : "Waiting for GPS")}
                        {v.lastPlaceKind ? ` (${v.lastPlaceKind === "Hub" ? "hub" : "on road"})` : ""}
                      </TableCell>
                      <TableCell>{v.wheelClass ?? v.type ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTable>
          </>
        )}
      </Card>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Recent riders</h3>
          {data.recentRiders.length === 0 ? (
            <EmptyState icon={<IconDashboard className="h-7 w-7" />} title="No riders yet" description="Create a rider from the Riders screen to populate this list." />
          ) : (
            <DataTable>
              <Table>
                <TableHead>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>KYC</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {data.recentRiders.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link className="font-semibold text-brand" href={`/riders/${r.id}`}>
                          {r.fullName ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{r.phone ?? "—"}</TableCell>
                      <TableCell><Badge status={r.accountStatus} /></TableCell>
                      <TableCell><Badge status={r.kycStatus} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTable>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Vehicles needing attention</h3>
          {data.vehiclesNeedingAttention.length === 0 ? (
            <Card className="p-6 text-sm text-text-secondary">No maintenance, offline, or low-battery vehicles right now.</Card>
          ) : (
            <DataTable>
              <Table>
                <TableHead>
                  <TableHeaderCell>Registration</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Battery</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {data.vehiclesNeedingAttention.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Link className="font-semibold text-brand" href={`/vehicles/${v.id}`}>
                          {v.registrationNumber}
                        </Link>
                      </TableCell>
                      <TableCell><Badge status={v.status} /></TableCell>
                      <TableCell>{v.batteryPercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTable>
          )}
        </div>
      </div>

      <Card className="mt-8 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Planned integrations</h3>
          <ComingSoonBadge />
        </div>
        <p className="mb-3 text-sm text-text-secondary">Razorpay live, SMS, push, document vault, KYC vendor and maps are provisioned in the UI.</p>
        <Link className="text-sm font-semibold text-brand" href="/integrations">Open integrations</Link>
      </Card>
    </div>
  );
}
