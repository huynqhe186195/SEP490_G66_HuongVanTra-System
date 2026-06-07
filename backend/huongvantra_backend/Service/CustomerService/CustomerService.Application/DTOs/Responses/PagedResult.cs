namespace CustomerService.Application.DTOs.Responses;

public record PagedResult<T>(
    IEnumerable<T> Items,
    int Page,
    int PageSize,
    int TotalCount
);
