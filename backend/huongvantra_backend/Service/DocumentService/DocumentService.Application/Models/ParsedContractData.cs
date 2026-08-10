namespace DocumentService.Application.Models;

public record ParsedContractData(
    string? ContractCode,
    DateOnly? EffectiveDate,
    string? SignedAtLocation,
    string BuyerCompanyName,
    string? BuyerTaxCode,
    List<ParsedLineItem> LineItems,
    string? PaymentMethod,
    string? DeliveryTerms,
    string? ShippingResponsibility);

public record ParsedLineItem(
    int LineNumber,
    string ProductName,
    string? Unit,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineAmount,
    string? Note);
