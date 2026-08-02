namespace DocumentService.Domain.Enums;

public enum ContractStatus
{
    Draft,
    PendingApproval,
    Active,
    Rejected,
    // Lưu dưới dạng int trong MySQL ⇒ giá trị mới bắt buộc đặt cuối, không đổi thứ tự phía trên.
    Expired
}
