# IoT Platform

Generic IoT integration layer for vehicle telematics.

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| Gateway | `iot/gateway/` | Azure IoT Hub bridge, command dispatch, telemetry ingestion |
| Adapters | `iot/adapters/` | Vendor-agnostic device adapter interface |
| Simulator | `iot/simulator/` | Dev vehicle simulator for testing without hardware |

## Adapter Pattern

All device vendors implement `IDeviceAdapter`:

```csharp
public interface IDeviceAdapter
{
    string VendorType { get; }
    Task<CommandResult> SendCommandAsync(string deviceId, DeviceCommand command);
    DeviceTelemetry? ParseTelemetry(byte[] payload);
}
```

Built-in adapters:
- **SimulatorAdapter** — local dev/testing
- **MqttGenericAdapter** — configurable MQTT topic mapping

## Commands

| Command | Description |
|---------|-------------|
| Lock | Lock vehicle |
| Unlock | Unlock vehicle |
| IgnitionOn | Start motor |
| IgnitionOff | Stop motor |
| GetLocation | Request GPS fix |
| GetBattery | State of charge |
| GetOdometer | Mileage reading |
| GetHealth | Diagnostic snapshot |

## Running the Simulator

```bash
cd iot/simulator
dotnet run -- sim-vehicle-001
```

## Running the Gateway

```bash
cd iot/gateway
dotnet run
```

Set `IoTHub:ConnectionString` in `appsettings.json` for Azure IoT Hub connectivity.

## Telemetry Flow

```
Device → IoT Hub (MQTT) → Event Hub → Gateway Processor → Platform API
Platform API → Gateway → IoT Hub → Device (cloud-to-device commands)
```

## Adding a New Vendor Adapter

1. Create class implementing `IDeviceAdapter` in `iot/adapters/`
2. Register in `DeviceAdapterRegistry`
3. Map vendor-specific protocol in `SendCommandAsync` and `ParseTelemetry`
