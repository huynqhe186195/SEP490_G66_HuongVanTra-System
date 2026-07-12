namespace ProductService.Domain.Enums;

public enum NewProductApprovalStatus
{
    Draft,
    AwaitingWarehouseConfirmation,
    Completed,
    ReturnedForCorrection,
    Rejected,
    Cancelled,
    Expired
}

