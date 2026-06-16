namespace OrderService.Application.DTOs.Responses;

using System.Text.Json.Serialization;

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

public record BuildTransferQrRequest(string OrderCode, decimal Amount, Guid? OrderId = null);

public record TransferQrResponse(
    string QrImageUrl,
    string? QrPayload,
    string TransferContent,
    string TransferAccountNumber,
    string PaymentMode,
    DateTime QrExpiresAtUtc,
    bool IsExpired);

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
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("gateway")] string? Gateway,
    [property: JsonPropertyName("transactionDate")] string? TransactionDate,
    [property: JsonPropertyName("accountNumber")] string? AccountNumber,
    [property: JsonPropertyName("subAccount")] string? SubAccount,
    [property: JsonPropertyName("code")] string? Code,
    [property: JsonPropertyName("content")] string? Content,
    [property: JsonPropertyName("transferType")] string? TransferType,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("transferAmount")] long TransferAmount,
    [property: JsonPropertyName("accumulated")] long Accumulated,
    [property: JsonPropertyName("referenceCode")] string? ReferenceCode);

public record SimulateSepayWebhookRequest(string OrderCode, decimal Amount);
