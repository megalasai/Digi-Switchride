using System.Text.Json;
using IoT.Gateway.Adapters;

Console.WriteLine("Digi-Switchride Vehicle Simulator");
Console.WriteLine("Simulates IoT telematics for development");
Console.WriteLine("Commands: lock, unlock, ignition-on, ignition-off, telemetry, quit");
Console.WriteLine();

var deviceId = args.Length > 0 ? args[0] : "sim-vehicle-001";
var adapter = new SimulatorAdapter();
var random = new Random();

double lat = 21.1458;
double lng = 79.0882;
int battery = 85;
double odometer = 1234.5;
bool running = true;

Console.WriteLine($"Device ID: {deviceId}");
Console.WriteLine($"Initial state: lat={lat}, lng={lng}, battery={battery}%");
Console.WriteLine();

var telemetryTask = Task.Run(async () =>
{
    while (running)
    {
        lat += (random.NextDouble() - 0.5) * 0.001;
        lng += (random.NextDouble() - 0.5) * 0.001;
        battery = Math.Max(0, battery - (random.Next(0, 2)));
        odometer += random.NextDouble() * 0.5;

        var telemetry = new DeviceTelemetry(deviceId, DateTime.UtcNow, lat, lng, battery, odometer, []);
        var json = JsonSerializer.Serialize(telemetry);
        Console.WriteLine($"[TELEMETRY] {json}");

        await Task.Delay(TimeSpan.FromSeconds(10));
    }
});

while (running)
{
    Console.Write("> ");
    var input = Console.ReadLine()?.Trim().ToLower();
    if (input is null) continue;

    switch (input)
    {
        case "quit":
        case "exit":
            running = false;
            break;
        case "lock":
            await adapter.SendCommandAsync(deviceId, DeviceCommand.Lock);
            Console.WriteLine("Vehicle locked");
            break;
        case "unlock":
            await adapter.SendCommandAsync(deviceId, DeviceCommand.Unlock);
            Console.WriteLine("Vehicle unlocked");
            break;
        case "ignition-on":
            await adapter.SendCommandAsync(deviceId, DeviceCommand.IgnitionOn);
            Console.WriteLine("Ignition ON");
            break;
        case "ignition-off":
            await adapter.SendCommandAsync(deviceId, DeviceCommand.IgnitionOff);
            Console.WriteLine("Ignition OFF");
            break;
        case "telemetry":
            var t = new DeviceTelemetry(deviceId, DateTime.UtcNow, lat, lng, battery, odometer, []);
            Console.WriteLine(JsonSerializer.Serialize(t));
            break;
        case "help":
            Console.WriteLine("Commands: lock, unlock, ignition-on, ignition-off, telemetry, quit");
            break;
        default:
            Console.WriteLine("Unknown command. Type 'help' for available commands.");
            break;
    }
}

await telemetryTask;
Console.WriteLine("Simulator stopped.");
