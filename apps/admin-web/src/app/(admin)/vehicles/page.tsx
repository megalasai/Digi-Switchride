"use client";

import { useEffect, useState } from "react";
import { api, Vehicle, Hub } from "@/lib/api";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ registrationNumber: "", type: "EScooter", hubId: "", model: "", iotDeviceId: "" });

  const load = () => {
    api.vehicles().then((r) => setVehicles(r.items)).catch(() => {});
    api.hubs().then((r) => setHubs(r.items)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createVehicle({ ...form, iotDeviceId: form.iotDeviceId || undefined });
    setShowForm(false);
    load();
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      Available: "text-green-600", InRide: "text-blue-600", Maintenance: "text-orange-600", Offline: "text-gray-400",
    };
    return map[s] ?? "text-gray-600";
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-green-600 text-white rounded-lg">
          {showForm ? "Cancel" : "Add Vehicle"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <input placeholder="Registration number" className="border rounded px-3 py-2" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required />
          <select className="border rounded px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="EScooter">E-Scooter</option>
            <option value="EBike">E-Bike</option>
            <option value="ERickshaw">E-Rickshaw</option>
          </select>
          <select className="border rounded px-3 py-2" value={form.hubId} onChange={(e) => setForm({ ...form, hubId: e.target.value })} required>
            <option value="">Select hub</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <input placeholder="Model" className="border rounded px-3 py-2" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
          <input placeholder="IoT Device ID (optional)" className="border rounded px-3 py-2" value={form.iotDeviceId} onChange={(e) => setForm({ ...form, iotDeviceId: e.target.value })} />
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">Register Vehicle</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Registration</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Model</th>
              <th className="text-left p-4">Battery</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{v.registrationNumber}</td>
                <td className="p-4">{v.type}</td>
                <td className="p-4">{v.model}</td>
                <td className="p-4">{v.batteryPercent}%</td>
                <td className={`p-4 font-medium ${statusColor(v.status)}`}>{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
