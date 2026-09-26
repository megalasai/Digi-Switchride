"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconActivity } from "@/components/icons";
import { api, Ride } from "@/lib/api";

export default function ActiveRidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    const load = () => api.activeRides().then((r) => setRides(r.items)).catch(() => {});
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <PageHeader title="Active Rides" description="Live rides — refreshes every 10 seconds" />
      {rides.length === 0 ? (
        <EmptyState
          icon={<IconActivity className="h-7 w-7" />}
          title="No active rides"
          description="Rides in progress will appear here with vehicle and start time details."
        />
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => (
            <Card key={ride.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-text-primary">Ride {ride.id.slice(0, 8)}…</p>
                <p className="text-sm text-text-secondary">Vehicle {ride.vehicleId.slice(0, 8)}…</p>
                <p className="text-sm text-text-muted">
                  Started {ride.startedAt ? new Date(ride.startedAt).toLocaleString() : "—"}
                </p>
              </div>
              <Badge status="Active" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
