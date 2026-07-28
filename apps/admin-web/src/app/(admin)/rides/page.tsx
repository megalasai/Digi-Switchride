"use client";

import { useEffect, useState } from "react";
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
      <h1 className="text-2xl font-bold mb-6">Active Rides</h1>
      {rides.length === 0 ? (
        <p className="text-gray-500">No active rides at the moment.</p>
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => (
            <div key={ride.id} className="bg-white rounded-lg shadow p-6 flex justify-between items-center">
              <div>
                <p className="font-medium">Ride {ride.id.slice(0, 8)}...</p>
                <p className="text-sm text-gray-500">Vehicle: {ride.vehicleId.slice(0, 8)}...</p>
                <p className="text-sm text-gray-500">Started: {ride.startedAt ? new Date(ride.startedAt).toLocaleString() : "—"}</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">In Progress</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
