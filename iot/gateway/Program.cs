using IoT.Gateway;
using IoT.Gateway.Adapters;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddSingleton<DeviceAdapterRegistry>();
builder.Services.AddSingleton<IoTHubBridgeService>();
builder.Services.AddHostedService<IoTHubBridgeService>();
builder.Services.AddHostedService<TelemetryProcessor>();
builder.Services.AddHttpClient();

var host = builder.Build();
host.Run();
