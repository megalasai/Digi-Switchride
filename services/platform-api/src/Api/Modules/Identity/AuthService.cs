using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Modules.Identity;

public interface IAuthService
{
    Task<SendOtpResponse> SendOtpAsync(SendOtpRequest request);
    Task<AuthTokens> VerifyOtpAsync(VerifyOtpRequest request);
    Task<AuthTokens> RefreshTokenAsync(string refreshToken);
    Guid? GetCustomerId(ClaimsPrincipal user);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<SendOtpResponse> SendOtpAsync(SendOtpRequest request)
    {
        var otp = CryptoHelper.GenerateOtp();
        var record = new OtpRecord
        {
            Id = Guid.NewGuid(),
            Phone = request.Phone,
            OtpHash = CryptoHelper.HashOtp(otp),
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };
        _db.OtpRecords.Add(record);
        await _db.SaveChangesAsync();

        // In production: send via SMS (Azure Communication Services / MSG91)
        Console.WriteLine($"[DEV] OTP for {request.Phone}: {otp}");

        return new SendOtpResponse("OTP sent successfully", 300);
    }

    public async Task<AuthTokens> VerifyOtpAsync(VerifyOtpRequest request)
    {
        var otpHash = CryptoHelper.HashOtp(request.Otp);
        var record = await _db.OtpRecords
            .Where(o => o.Phone == request.Phone && !o.IsUsed && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("Invalid or expired OTP");

        if (record.OtpHash != otpHash)
            throw new UnauthorizedAccessException("Invalid or expired OTP");

        record.IsUsed = true;

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == request.Phone);
        var isNewUser = customer is null;

        if (customer is null)
        {
            customer = new Customer
            {
                Id = Guid.NewGuid(),
                Phone = request.Phone
            };
            _db.Customers.Add(customer);
        }

        await _db.SaveChangesAsync();
        return await IssueTokensAsync(customer, isNewUser);
    }

    public async Task<AuthTokens> RefreshTokenAsync(string refreshToken)
    {
        var hash = CryptoHelper.HashOtp(refreshToken);
        var token = await _db.RefreshTokens
            .Include(t => t.Customer)
            .FirstOrDefaultAsync(t => t.TokenHash == hash && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow)
            ?? throw new UnauthorizedAccessException("Invalid refresh token");

        token.IsRevoked = true;
        return await IssueTokensAsync(token.Customer, false);
    }

    private async Task<AuthTokens> IssueTokensAsync(Customer customer, bool isNewUser)
    {
        var accessToken = GenerateJwt(customer);
        var refreshTokenValue = Guid.NewGuid().ToString("N");
        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            TokenHash = CryptoHelper.HashOtp(refreshTokenValue),
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        });
        await _db.SaveChangesAsync();

        return new AuthTokens(accessToken, refreshTokenValue, 3600, isNewUser);
    }

    private string GenerateJwt(Customer customer)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "dev-secret-key-min-32-chars-long!!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, customer.Id.ToString()),
            new Claim(ClaimTypes.MobilePhone, customer.Phone),
            new Claim(ClaimTypes.Role, "Customer")
        };
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "digi-switchride",
            audience: _config["Jwt:Audience"] ?? "digi-switchride",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public Guid? GetCustomerId(ClaimsPrincipal user)
    {
        var id = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return id is not null ? Guid.Parse(id) : null;
    }
}
