namespace PlatformApi.Shared.Domain;

public class KycSubmission
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public KycDocumentType DocumentType { get; set; }
    public string? DocumentNumberMasked { get; set; }
    public string? BlobUrl { get; set; }
    public KycStatusEnum Status { get; set; } = KycStatusEnum.Pending;
    public string? RejectionReason { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedBy { get; set; }

    public Customer Customer { get; set; } = null!;
}

public enum KycDocumentType
{
    Aadhaar,
    PAN,
    DrivingLicence,
    Selfie
}
