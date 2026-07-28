using Microsoft.EntityFrameworkCore;
using PlatformApi.Shared.Domain;

namespace PlatformApi.Shared.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<KycSubmission> KycSubmissions => Set<KycSubmission>();
    public DbSet<RentalHub> RentalHubs => Set<RentalHub>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Ride> Rides => Set<Ride>();
    public DbSet<TelemetryPoint> TelemetryPoints => Set<TelemetryPoint>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<Promotion> Promotions => Set<Promotion>();
    public DbSet<IoTDevice> IoTDevices => Set<IoTDevice>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<OtpRecord> OtpRecords => Set<OtpRecord>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("postgis");

        modelBuilder.Entity<Customer>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Phone).IsUnique();
        });

        modelBuilder.Entity<KycSubmission>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Customer).WithMany(c => c.KycSubmissions).HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<RentalHub>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Location).HasColumnType("geometry(Point, 4326)");
        });

        modelBuilder.Entity<Vehicle>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.RegistrationNumber).IsUnique();
            e.HasOne(x => x.Hub).WithMany(h => h.Vehicles).HasForeignKey(x => x.HubId);
        });

        modelBuilder.Entity<Booking>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Customer).WithMany(c => c.Bookings).HasForeignKey(x => x.CustomerId);
            e.HasOne(x => x.Vehicle).WithMany(v => v.Bookings).HasForeignKey(x => x.VehicleId);
            e.HasOne(x => x.Hub).WithMany().HasForeignKey(x => x.HubId);
            e.HasOne(x => x.Ride).WithOne(r => r.Booking).HasForeignKey<Ride>(r => r.BookingId);
        });

        modelBuilder.Entity<Ride>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.StartLocation).HasColumnType("geometry(Point, 4326)");
            e.Property(x => x.EndLocation).HasColumnType("geometry(Point, 4326)");
            e.HasIndex(x => x.StartIdempotencyKey).IsUnique().HasFilter("\"StartIdempotencyKey\" IS NOT NULL");
            e.HasIndex(x => x.EndIdempotencyKey).IsUnique().HasFilter("\"EndIdempotencyKey\" IS NOT NULL");
        });

        modelBuilder.Entity<TelemetryPoint>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Location).HasColumnType("geometry(Point, 4326)");
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.RazorpayOrderId);
            e.HasOne(x => x.Customer).WithMany(c => c.Payments).HasForeignKey(x => x.CustomerId);
            e.HasOne(x => x.Booking).WithMany(b => b.Payments).HasForeignKey(x => x.BookingId);
        });

        modelBuilder.Entity<SupportTicket>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Customer).WithMany(c => c.SupportTickets).HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<Promotion>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<IoTDevice>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.DeviceId).IsUnique();
        });

        modelBuilder.Entity<OtpRecord>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Phone);
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId);
        });
    }
}
