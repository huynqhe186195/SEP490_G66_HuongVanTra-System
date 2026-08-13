namespace DocumentService.Application.DTOs.Responses;

public enum MatchConfidence { Exact, High, Medium, Low, NotFound }

public record CustomerMatchResult(
    Guid? CustomerId,
    string ParsedName,
    string? MatchedName,
    MatchConfidence Confidence);

public record LineItemMatchResult(
    int LineNumber,
    string ParsedName,
    string? ParsedUnit,
    decimal ParsedQuantity,
    decimal ParsedUnitPrice,
    Guid? SkuId,
    string? MatchedName,
    MatchConfidence Confidence);

public record ContractImportResult(
    bool Success,
    Guid? ContractId,
    string? ContractCode,
    List<string> Errors,
    List<string> Warnings,
    CustomerMatchResult? CustomerMatch,
    List<LineItemMatchResult> LineItemMatches);
