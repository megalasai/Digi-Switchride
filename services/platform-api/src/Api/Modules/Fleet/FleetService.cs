using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Modules.Fleet;

public interface IFleetService
{
    Task<List<RentalHubSummaryDto>> GetNearbyHubsAsync(double lat, double lng, double radiusKm);
    Task<RentalHubDto> GetHubAsync(Guid hubId, double? lat, double? lng);
    Task<List<VehicleSummaryDto>> GetHubVehiclesAsync(Guid hubId, VehicleStatus? status);
    Task<VehicleDto> GetVehicleAsync(Guid vehicleId);
    Task<RentalHubDto> CreateHubAsync(CreateHubRequest request);
    Task<VehicleDto> CreateVehicleAsync(CreateVehicleRequest request);
    Task<List<VehicleDto>> ListAllVehiclesAsync();
    Task<List<RentalHubDto>> ListAllHubsAsync();
}

public class FleetService : IFleetService
{
    private readonly AppDbContext _db;
    private static readonly GeometryFactory Gf = new(new PrecisionModel(), 4326);

    public FleetService(AppDbContext db) => _db = db;

    public async Task<List<RentalHubSummaryDto>> GetNearbyHubsAsync(double lat, double lng, double radiusKm)
    {
        var hubs = await _db.RentalHubs
            .Where(h => h.Status == HubStatus.Active)
            .Include(h => h.Vehicles)
            .ToListAsync();

        return hubs
            .Select(h =>
            {
                var dist = GeoHelper.HaversineDistanceKm(lat, lng, h.Location.Y, h.Location.X);
                return new { Hub = h, Distance = dist };
            })
            .Where(x => x.Distance <= radiusKm)
            .OrderBy(x => x.Distance)
            .Select(x => new RentalHubSummaryDto(
                x.Hub.Id, x.Hub.Name,
                new GeoPointDto(x.Hub.Location.Y, x.Hub.Location.X),
                Math.Round(x.Distance, 2),
                x.Hub.Vehicles.Count(v => v.Status == VehicleStatus.Available),
                x.Hub.Status.ToString()))
            .ToList();
    }

    public async Task<RentalHubDto> GetHubAsync(Guid hubId, double? lat, double? lng)
    {
        var hub = await _db.RentalHubs.Include(h => h.Vehicles).FirstOrDefaultAsync(h => h.Id == hubId)
            ?? throw new KeyNotFoundException("Hub not found");

        var dist = lat.HasValue && lng.HasValue
            ? GeoHelper.HaversineDistanceKm(lat.Value, lng.Value, hub.Location.Y, hub.Location.X)
            : 0;

        return MapHub(hub, dist);
    }

    public async Task<List<VehicleSummaryDto>> GetHubVehiclesAsync(Guid hubId, VehicleStatus? status)
    {
        var query = _db.Vehicles.Where(v => v.HubId == hubId);
        if (status.HasValue) query = query.Where(v => v.Status == status.Value);

        return await query.Select(v => new VehicleSummaryDto(
            v.Id, v.RegistrationNumber, v.Type.ToString(), v.Status.ToString(),
            v.BatteryPercent, v.Model)).ToListAsync();
    }

    public async Task<VehicleDto> GetVehicleAsync(Guid vehicleId)
    {
        var v = await _db.Vehicles.FindAsync(vehicleId)
            ?? throw new KeyNotFoundException("Vehicle not found");
        return MapVehicle(v);
    }

    public async Task<RentalHubDto> CreateHubAsync(CreateHubRequest request)
    {
        var hub = new RentalHub
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Address = request.Address,
            Location = Gf.CreatePoint(new Coordinate(request.Location.Lng, request.Location.Lat)),
            Capacity = request.Capacity,
            OperatingHours = request.OperatingHours,
            GeoFenceRadiusM = request.GeoFenceRadiusM
        };
        _db.RentalHubs.Add(hub);
        await _db.SaveChangesAsync();
        return MapHub(hub, 0);
    }

    public async Task<VehicleDto> CreateVehicleAsync(CreateVehicleRequest request)
    {
        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            RegistrationNumber = request.RegistrationNumber,
            Type = Enum.Parse<VehicleType>(request.Type),
            HubId = request.HubId,
            Model = request.Model,
            IoTDeviceId = request.IoTDeviceId,
            BatteryPercent = 100
        };
        _db.Vehicles.Add(vehicle);
        await _db.SaveChangesAsync();
        return MapVehicle(vehicle);
    }

    public async Task<List<VehicleDto>> ListAllVehiclesAsync()
    {
        return await _db.Vehicles.Select(v => MapVehicle(v)).ToListAsync();
    }

    public async Task<List<RentalHubDto>> ListAllHubsAsync()
    {
        var hubs = await _db.RentalHubs.Include(h => h.Vehicles).ToListAsync();
        return hubs.Select(h => MapHub(h, 0)).ToList();
    }

    private static RentalHubDto MapHub(RentalHub h, double dist) => new(
        h.Id, h.Name, new GeoPointDto(h.Location.Y, h.Location.X), Math.Round(dist, 2),
        h.Vehicles.Count(v => v.Status == VehicleStatus.Available), h.Status.ToString(),
        h.Address, h.Capacity, h.OperatingHours, h.GeoFenceRadiusM);

    private static VehicleDto MapVehicle(Vehicle v) => new(
        v.Id, v.RegistrationNumber, v.Type.ToString(), v.Status.ToString(),
        v.BatteryPercent, v.Model, v.HubId, v.OdometerKm, v.IoTDeviceId, v.PricingTier);
}
