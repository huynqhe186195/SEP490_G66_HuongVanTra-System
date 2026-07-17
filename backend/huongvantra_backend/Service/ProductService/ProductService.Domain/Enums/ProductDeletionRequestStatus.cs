namespace ProductService.Domain.Enums;

public enum ProductDeletionRequestStatus
{
    Draft = 0,
    PendingApproval = 1,
    Rejected = 2,
    Completed = 3,
    Cancelled = 4
}
