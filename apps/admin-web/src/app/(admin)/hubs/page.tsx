"use client";

import { useEffect, useState } from "react";
import { api, Hub } from "@/lib/api";

export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", lat: "21.1458", lng: "79.0882", capacity: "20" });

  const load = () => api.hubs().then((r) => setHubs(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createHub({
      name: form.name,
      address: form.address,
      location: { lat: parseFloat(form.lat), lng: parseFloat(form.lng) },
      capacity: parseInt(form.capacity),
    });
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rental Hubs</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-green-600 text-white rounded-lg">
          {showForm ? "Cancel" : "Add Hub"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <input placeholder="Hub name" className="border rounded px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Address" className="border rounded px-3 py-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          <input placeholder="Latitude" className="border rounded px-3 py-2" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          <input placeholder="Longitude" className="border rounded px-3 py-2" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
          <input placeholder="Capacity" type="number" className="border rounded px-3 py-2" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">Create Hub</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hubs.map((hub) => (
          <div key={hub.id} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-lg">{hub.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{hub.address}</p>
            <div className="mt-4 flex justify-between text-sm">
              <span>Available: {hub.availableVehicles}</span>
              <span>Capacity: {hub.capacity}</span>
              <span className={`font-medium ${hub.status === "Active" ? "text-green-600" : "text-gray-400"}`}>{hub.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
