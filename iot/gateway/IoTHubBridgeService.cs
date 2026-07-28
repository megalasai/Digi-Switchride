using IoT.Gateway.Adapters;
using Microsoft.Azure.Devices;

namespace IoT.Gateway;

public class IoTHubBridgeService : BackgroundService
{
    private readonly ILogger<IoTHubBridgeService> _logger;
    private readonly DeviceAdapterRegistry _adapters;
    private readonly IConfiguration _config;
    private ServiceClient? _serviceClient;

    public IoTHubBridgeService(ILogger<IoTHubBridgeService> logger, DeviceAdapterRegistry adapters, IConfiguration config)
    {
        _logger = logger;
        _adapters = adapters;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var connectionString = _config["IoTHub:ConnectionString"];
        if (string.IsNullOrEmpty(connectionString))
        {
            _logger.LogWarning("IoT Hub connection string not configured. Running in local mode.");
            await RunLocalModeAsync(stoppingToken);
            return;
        }

        _serviceClient = ServiceClient.CreateFromConnectionString(connectionString);
        _logger.LogInformation("IoT Gateway connected to Azure IoT Hub");
        await RunLocalModeAsync(stoppingToken);
    }

    private async Task RunLocalModeAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
        }
    }

    public async Task<CommandResult> SendCloudToDeviceCommandAsync(string deviceId, string vendorType, DeviceCommand command)
    {
        var adapter = _adapters.GetAdapter(vendorType);
        var result = await adapter.SendCommandAsync(deviceId, command, CancellationToken.None);

        if (_serviceClient is not null)
        {
            var message = new Message(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(new
            {
                command = command.ToString(),
                timestamp = DateTime.UtcNow
            }));
            await _serviceClient.SendAsync(deviceId, message);
        }

        _logger.LogInformation("Command {Command} sent to device {DeviceId}: {Success}",
            command, deviceId, result.Success);
        return result;
    }
}

public class TelemetryProcessor : BackgroundService
{
    private readonly ILogger<TelemetryProcessor> _logger;
    private readonly DeviceAdapterRegistry _adapters;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;

    public TelemetryProcessor(
        ILogger<TelemetryProcessor> logger,
        DeviceAdapterRegistry adapters,
        IHttpClientFactory httpClientFactory,
        IConfiguration config)
    {
        _logger = logger;
        _adapters = adapters;
        _httpClientFactory = httpClientFactory;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Telemetry processor started");
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }

    public async Task ProcessTelemetryAsync(string vendorType, byte[] payload)
    {
        var adapter = _adapters.GetAdapter(vendorType);
        var telemetry = adapter.ParseTelemetry(payload);
        if (telemetry is null) return;

        _logger.LogInformation("Telemetry from {DeviceId}: battery={Battery}%, lat={Lat}, lng={Lng}",
            telemetry.DeviceId, telemetry.BatteryPercent, telemetry.Lat, telemetry.Lng);

        var apiUrl = _config["PlatformApi:BaseUrl"];
        if (!string.IsNullOrEmpty(apiUrl))
        {
            var client = _httpClientFactory.CreateClient();
            await client.PostAsJsonAsync($"{apiUrl}/internal/iot/telemetry", telemetry);
        }
    }
}
