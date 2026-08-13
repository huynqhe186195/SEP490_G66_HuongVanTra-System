using OrderService.Domain.Entities;

namespace OrderService.Application.DTOs.Responses;

public record ReturnPolicyAcceptanceResult(
    ReturnPolicy Policy,
    ReturnPolicyResponse PolicyDto,
    bool Passed,
    bool ManagerOverrideApplied,
    IReadOnlyList<string> FailureReasons,
    string ChecklistAnswersJson,
    IReadOnlyList<string> EvidenceImageUrls,
    string EvaluationNote);
