using DocumentService.Domain.Enums;

namespace DocumentService.Application.DTOs.Requests;

public record CreateContractRequest(
    Guid CustomerId,
    string Title,
    ContractType ContractType,
    DateOnly? EffectiveDate,
    DateOnly? ExpiryDate,
    decimal? DiscountPercent,
    decimal? CreditLimit,
    int? PaymentTermDays,
    string? Notes);

public record UpdateContractRequest(
    string Title,
    ContractType ContractType,
    DateOnly? EffectiveDate,
    DateOnly? ExpiryDate,
    decimal? DiscountPercent,
    decimal? CreditLimit,
    int? PaymentTermDays,
    string? Notes);

public record ReviewContractRequest(
    bool Approved,
    string? RejectionNote);
