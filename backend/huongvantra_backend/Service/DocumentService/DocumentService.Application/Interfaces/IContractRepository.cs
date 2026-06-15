using DocumentService.Domain.Entities;
using DocumentService.Domain.Enums;

namespace DocumentService.Application.Interfaces;

public interface IContractRepository
{
    Task<(List<Contract> Items, int Total)> GetPagedAsync(
        string? search,
        Guid? customerId,
        ContractStatus? status,
        Guid? createdByUserId,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<Contract?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Contract contract, CancellationToken ct = default);
    void Update(Contract contract);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<string> GenerateNextContractCodeAsync(CancellationToken ct = default);
}
