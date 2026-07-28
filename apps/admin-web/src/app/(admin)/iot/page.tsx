"use client";

import { useEffect, useState } from "react";
import { api, IoTDevice } from "@/lib/api";

const COMMANDS = ["Lock", "Unlock", "IgnitionOn", "IgnitionOff", "GetLocation", "GetBattery", "GetOdometer", "GetHealth"];

export default function IoTPage() {
  const [devices, setDevices] = useState<IoTDevice[]>([]);

  const load = () => api.iotDevices().then((r) => setDevices(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);

  const sendCommand = async (deviceId: string, command: string) => {
    await api.sendIoTCommand(deviceId, command);
    alert(`Command '${command}' sent to ${deviceId}`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">IoT Devices</h1>
      {devices.length === 0 ? (
        <p className="text-gray-500">No IoT devices registered.</p>
      ) : (
        <div className="space-y-4">
          {devices.map((d) => (
            <div key={d.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{d.id}</p>
                  <p className="text-sm text-gray-500">Vendor: {d.vendorType}</p>
                  <p className="text-sm text-gray-500">
                    Status: <span className={d.connectionStatus === "Connected" ? "text-green-600" : "text-red-600"}>{d.connectionStatus}</span>
                  </p>
                  {d.batteryPercent != null && <p className="text-sm">Battery: {d.batteryPercent}%</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {COMMANDS.map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => sendCommand(d.id, cmd)}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
