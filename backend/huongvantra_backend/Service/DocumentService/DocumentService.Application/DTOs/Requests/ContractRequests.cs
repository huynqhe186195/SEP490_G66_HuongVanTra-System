using DocumentService.Domain.Enums;

namespace DocumentService.Application.DTOs.Requests;

public record ContractLineItemRequest(
    Guid SkuId,
    decimal Quantity,
    decimal UnitPrice,
    string? Note = null);

public record CreateContractRequest(
    Guid CustomerId,
    string Title,
    ContractType ContractType,
    DateOnly? EffectiveDate,
    DateOnly? ExpiryDate,
    decimal? DiscountPercent,
    decimal? CreditLimit,
    int? PaymentTermDays,
    string? Notes,
    string? SignedAtLocation = null,
    string? PaymentMethod = null,
    string? DeliveryTerms = null,
    string? ShippingResponsibility = null,
    List<ContractLineItemRequest>? LineItems = null);

public record UpdateContractRequest(
    string Title,
    ContractType ContractType,
    DateOnly? EffectiveDate,
    DateOnly? ExpiryDate,
    decimal? DiscountPercent,
    decimal? CreditLimit,
    int? PaymentTermDays,
    string? Notes,
    string? SignedAtLocation = null,
    string? PaymentMethod = null,
    string? DeliveryTerms = null,
    string? ShippingResponsibility = null,
    List<ContractLineItemRequest>? LineItems = null);

public record ReviewContractRequest(
    bool Approved,
    string? RejectionNote);

