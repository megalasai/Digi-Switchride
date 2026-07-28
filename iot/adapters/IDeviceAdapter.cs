namespace IoT.Gateway.Adapters;

public enum DeviceCommand
{
    Lock,
    Unlock,
    IgnitionOn,
    IgnitionOff,
    GetLocation,
    GetBattery,
    GetOdometer,
    GetHealth
}

public record DeviceTelemetry(
    string DeviceId,
    DateTime Timestamp,
    double Lat,
    double Lng,
    int BatteryPercent,
    double OdometerKm,
    List<string> Alerts);

public record CommandResult(string DeviceId, DeviceCommand Command, bool Success, string? Message);

public interface IDeviceAdapter
{
    string VendorType { get; }
    Task<CommandResult> SendCommandAsync(string deviceId, DeviceCommand command, CancellationToken ct = default);
    DeviceTelemetry? ParseTelemetry(byte[] payload);
}

public class SimulatorAdapter : IDeviceAdapter
{
    public string VendorType => "Simulator";

    private readonly Dictionary<string, SimulatorState> _states = new();

    public Task<CommandResult> SendCommandAsync(string deviceId, DeviceCommand command, CancellationToken ct = default)
    {
        var state = _states.GetValueOrDefault(deviceId) ?? new SimulatorState();
        _states[deviceId] = state;

        switch (command)
        {
            case DeviceCommand.Unlock:
                state.IsLocked = false;
                break;
            case DeviceCommand.Lock:
                state.IsLocked = true;
                break;
            case DeviceCommand.IgnitionOn:
                state.IgnitionOn = true;
                break;
            case DeviceCommand.IgnitionOff:
                state.IgnitionOn = false;
                break;
        }

        return Task.FromResult(new CommandResult(deviceId, command, true, $"Command {command} executed"));
    }

    public DeviceTelemetry? ParseTelemetry(byte[] payload)
    {
        var json = System.Text.Encoding.UTF8.GetString(payload);
        return System.Text.Json.JsonSerializer.Deserialize<DeviceTelemetry>(json);
    }

    private class SimulatorState
    {
        public bool IsLocked = true;
        public bool IgnitionOn;
    }
}

public class MqttGenericAdapter : IDeviceAdapter
{
    public string VendorType => "MqttGeneric";

    public Task<CommandResult> SendCommandAsync(string deviceId, DeviceCommand command, CancellationToken ct = default)
    {
        // In production: publish to MQTT topic vehicles/{deviceId}/commands
        Console.WriteLine($"[MQTT] {deviceId} -> {command}");
        return Task.FromResult(new CommandResult(deviceId, command, true, null));
    }

    public DeviceTelemetry? ParseTelemetry(byte[] payload)
    {
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<DeviceTelemetry>(payload);
        }
        catch { return null; }
    }
}

public class DeviceAdapterRegistry
{
    private readonly Dictionary<string, IDeviceAdapter> _adapters = new();

    public DeviceAdapterRegistry()
    {
        Register(new SimulatorAdapter());
        Register(new MqttGenericAdapter());
    }

    public void Register(IDeviceAdapter adapter) => _adapters[adapter.VendorType] = adapter;

    public IDeviceAdapter GetAdapter(string vendorType) =>
        _adapters.GetValueOrDefault(vendorType) ?? _adapters["Simulator"];
}
