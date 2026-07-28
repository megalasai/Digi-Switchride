using Microsoft.EntityFrameworkCore;
using PlatformApi.Shared.Data;
using PlatformApi.Shared.Domain;
using PlatformApi.Shared.Dtos;

namespace PlatformApi.Modules.UsersKyc;

public interface IKycService
{
    Task<KycSubmissionDto> SubmitAsync(Guid customerId, KycDocumentType docType, string? docNumber, Stream? fileStream, string? fileName);
    Task<KycStatusDto> GetStatusAsync(Guid customerId);
    Task ReviewAsync(Guid customerId, KycReviewRequest request, Guid adminId);
}

public class KycService : IKycService
{
    private readonly AppDbContext _db;

    public KycService(AppDbContext db) => _db = db;

    public async Task<KycSubmissionDto> SubmitAsync(Guid customerId, KycDocumentType docType, string? docNumber, Stream? fileStream, string? fileName)
    {
        var customer = await _db.Customers.FindAsync(customerId)
            ?? throw new KeyNotFoundException("Customer not found");

        var maskedNumber = docType == KycDocumentType.Aadhaar && docNumber is not null
            ? CryptoHelper.MaskAadhaar(docNumber)
            : docNumber;

        var submission = new KycSubmission
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            DocumentType = docType,
            DocumentNumberMasked = maskedNumber,
            BlobUrl = fileName is not null ? $"kyc/{customerId}/{docType}/{fileName}" : null,
            Status = KycStatusEnum.Pending
        };

        _db.KycSubmissions.Add(submission);
        customer.KycStatus = KycStatusEnum.Pending;
        customer.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new KycSubmissionDto(submission.Id, docType.ToString(), submission.Status.ToString(), submission.SubmittedAt);
    }

    public async Task<KycStatusDto> GetStatusAsync(Guid customerId)
    {
        var customer = await _db.Customers
            .Include(c => c.KycSubmissions)
            .FirstOrDefaultAsync(c => c.Id == customerId)
            ?? throw new KeyNotFoundException("Customer not found");

        var submissions = customer.KycSubmissions
            .Select(s => new KycSubmissionDto(s.Id, s.DocumentType.ToString(), s.Status.ToString(), s.SubmittedAt))
            .ToList();

        var rejectionReason = customer.KycSubmissions
            .FirstOrDefault(s => s.Status == KycStatusEnum.Rejected)?.RejectionReason;

        return new KycStatusDto(customer.KycStatus.ToString(), submissions, rejectionReason);
    }

    public async Task ReviewAsync(Guid customerId, KycReviewRequest request, Guid adminId)
    {
        var customer = await _db.Customers
            .Include(c => c.KycSubmissions)
            .FirstOrDefaultAsync(c => c.Id == customerId)
            ?? throw new KeyNotFoundException("Customer not found");

        if (request.Action == "Approve")
        {
            customer.KycStatus = KycStatusEnum.Approved;
            foreach (var sub in customer.KycSubmissions.Where(s => s.Status == KycStatusEnum.Pending || s.Status == KycStatusEnum.UnderReview))
            {
                sub.Status = KycStatusEnum.Approved;
                sub.ReviewedAt = DateTime.UtcNow;
                sub.ReviewedBy = adminId;
            }
        }
        else
        {
            customer.KycStatus = KycStatusEnum.Rejected;
            foreach (var sub in customer.KycSubmissions.Where(s => s.Status == KycStatusEnum.Pending || s.Status == KycStatusEnum.UnderReview))
            {
                sub.Status = KycStatusEnum.Rejected;
                sub.RejectionReason = request.Reason;
                sub.ReviewedAt = DateTime.UtcNow;
                sub.ReviewedBy = adminId;
            }
        }

        customer.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}

public interface IProfileService
{
    Task<CustomerProfileDto> GetAsync(Guid customerId);
    Task<CustomerProfileDto> UpdateAsync(Guid customerId, UpdateProfileRequest request);
}

public class ProfileService : IProfileService
{
    private readonly AppDbContext _db;
    public ProfileService(AppDbContext db) => _db = db;

    public async Task<CustomerProfileDto> GetAsync(Guid customerId)
    {
        var c = await _db.Customers.FindAsync(customerId)
            ?? throw new KeyNotFoundException("Customer not found");
        return Map(c);
    }

    public async Task<CustomerProfileDto> UpdateAsync(Guid customerId, UpdateProfileRequest request)
    {
        var c = await _db.Customers.FindAsync(customerId)
            ?? throw new KeyNotFoundException("Customer not found");
        if (request.Email is not null) c.Email = request.Email;
        if (request.FullName is not null) c.FullName = request.FullName;
        if (request.EmergencyContact is not null) c.EmergencyContact = request.EmergencyContact;
        c.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Map(c);
    }

    private static CustomerProfileDto Map(Customer c) =>
        new(c.Id, c.Phone, c.Email, c.FullName, c.KycStatus.ToString(), c.AccountStatus.ToString(), c.CreatedAt);
}
