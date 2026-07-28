#!/usr/bin/env node
const deviceId = process.argv[2] ?? 'sim-vehicle-001';
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1/internal/iot/telemetry';

let lat = 21.1458;
let lng = 79.0882;
let battery = 85;
let odometer = 1234.5;
let running = true;

console.log(`Digi-Switchride Vehicle Simulator — ${deviceId}`);
console.log('Commands: lock, unlock, ignition-on, ignition-off, telemetry, quit\n');

async function sendTelemetry() {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, lat, lng, batteryPercent: battery, odometerKm: odometer }),
    });
  } catch {
    // API may not be running
  }
}

setInterval(() => {
  if (!running) return;
  lat += (Math.random() - 0.5) * 0.001;
  lng += (Math.random() - 0.5) * 0.001;
  battery = Math.max(0, battery - Math.floor(Math.random() * 2));
  odometer += Math.random() * 0.5;
  sendTelemetry();
}, 10000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
  const cmd = data.trim().toLowerCase();
  if (cmd === 'quit' || cmd === 'exit') { running = false; process.exit(0); }
  else if (cmd === 'telemetry') sendTelemetry().then(() => console.log('Telemetry sent'));
  else console.log(`[SIM] Command: ${cmd}`);
});
