# IoT Simulator (Node.js)

Interactive CLI simulator for vehicle telematics during development.

The NestJS API (`apps/api`) handles IoT command dispatch and telemetry ingestion.
This simulator sends mock telemetry and accepts lock/unlock commands for testing.

## Usage

```bash
node iot/simulator/simulator.mjs sim-vehicle-001
```

Commands: `lock`, `unlock`, `ignition-on`, `ignition-off`, `telemetry`, `quit`

Telemetry is POSTed to `http://localhost:4000/api/v1/internal/iot/telemetry`

## Device ↔ vehicle mapping

Telemetry only updates a vehicle when the device is linked:

1. **Register a vehicle** in Admin → Vehicles with IoT Device ID `sim-vehicle-001`, or
2. **Link manually** in Admin → IoT Devices using the link form

Once linked, each telemetry payload updates the vehicle's **battery**, **odometer**, and **last known location**.
