namespace OrderService.Application.DTOs.Responses;

public record TransferPaymentInfoResponse(
    string BankCode,
    string BankBin,
    string BankName,
    string AccountNumber,
    string AccountHolder,
    string PaymentMode,
    bool SepayOrderVaEnabled,
    bool SepayWebhookEnabled);

public record SepayBankAccountResponse(
    string Id,
    string BankName,
    string AccountNumber,
    string AccountHolderName,
    string Status);

public record SepaySetupResponse(
    string PaymentMode,
    bool RequireSepayVa,
    bool ApiTokenConfigured,
    bool BankAccountUuidConfigured,
    bool StaticVaConfigured,
    bool CanCreateTransferQr,
    string? SetupMessage,
    IReadOnlyList<SepayBankAccountResponse> BankAccounts);

public record BuildTransferQrRequest(string OrderCode, decimal Amount);

public record TransferQrResponse(
    string QrImageUrl,
    string? QrPayload,
    string TransferContent,
    string TransferAccountNumber,
    string PaymentMode,
    DateTime QrExpiresAtUtc);

public record PosOrderPaymentStatusResponse(
    Guid OrderId,
    string OrderCode,
    string PaymentStatus,
    string OrderStatus,
    bool IsPaid,
    string? InvoiceCode,
    string ExpectedTransferContent,
    decimal ExpectedAmount);

public record SepayWebhookPayload(
    long Id,
    string? Gateway,
    string? TransactionDate,
    string? AccountNumber,
    string? SubAccount,
    string? Code,
    string? Content,
    string? TransferType,
    string? Description,
    long TransferAmount,
    long Accumulated,
    string? ReferenceCode);

public record SimulateSepayWebhookRequest(string OrderCode, decimal Amount);
