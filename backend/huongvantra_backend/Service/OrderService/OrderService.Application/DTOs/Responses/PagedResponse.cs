namespace OrderService.Application.DTOs.Responses;

public record PagedResponse<T>(
    List<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    /// <summary>Số lượng theo trạng thái (cùng filter list, bỏ status). Key = status string.</summary>
    Dictionary<string, int>? StatusCounts = null
);
