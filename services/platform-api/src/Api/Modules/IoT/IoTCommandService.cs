using Microsoft.EntityFrameworkCore;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Modules.IoT;

public interface IIoTCommandService
{
    Task<IoTCommandResponse> SendCommandAsync(string deviceId, string command);
    Task<List<IoTDeviceDto>> ListDevicesAsync();
    Task UpdateTelemetryAsync(string deviceId, double lat, double lng, int battery, double odometer);
}

public class IoTCommandService : IIoTCommandService
{
    private readonly AppDbContext _db;

    public IoTCommandService(AppDbContext db) => _db = db;

    public async Task<IoTCommandResponse> SendCommandAsync(string deviceId, string command)
    {
        var device = await _db.IoTDevices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);

        if (device is null)
        {
            device = new IoTDevice
            {
                Id = Guid.NewGuid(),
                DeviceId = deviceId,
                VendorType = "Simulator"
            };
            _db.IoTDevices.Add(device);
        }

        // In production: send via Azure IoT Hub cloud-to-device message
        Console.WriteLine($"[IoT] Command '{command}' sent to device {deviceId}");

        var commandId = Guid.NewGuid();
        return new IoTCommandResponse(commandId, "Sent");
    }

    public async Task<List<IoTDeviceDto>> ListDevicesAsync()
    {
        return await _db.IoTDevices.Select(d => new IoTDeviceDto(
            d.DeviceId, d.VehicleId, d.VendorType, d.ConnectionStatus.ToString(),
            d.LastSeenAt, d.BatteryPercent,
            d.LastLat.HasValue && d.LastLng.HasValue
                ? new GeoPointDto(d.LastLat.Value, d.LastLng.Value) : null
        )).ToListAsync();
    }

    public async Task UpdateTelemetryAsync(string deviceId, double lat, double lng, int battery, double odometer)
    {
        var device = await _db.IoTDevices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);
        if (device is null) return;

        device.LastLat = lat;
        device.LastLng = lng;
        device.BatteryPercent = battery;
        device.LastSeenAt = DateTime.UtcNow;
        device.ConnectionStatus = IoTConnectionStatus.Connected;

        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.IoTDeviceId == deviceId);
        if (vehicle is not null)
        {
            vehicle.BatteryPercent = battery;
            vehicle.OdometerKm = odometer;
            vehicle.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }
}
