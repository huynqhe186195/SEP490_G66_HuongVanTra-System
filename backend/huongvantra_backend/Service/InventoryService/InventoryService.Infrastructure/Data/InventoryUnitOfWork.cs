using InventoryService.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Data;

public class InventoryUnitOfWork(InventoryDbContext _db) : IInventoryUnitOfWork
{
    public Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action, CancellationToken ct = default)
    {
        return _db.Database.CreateExecutionStrategy().ExecuteAsync(async innerCt =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(innerCt);
            try
            {
                var result = await action(innerCt);
                await tx.CommitAsync(innerCt);
                return result;
            }
            catch
            {
                await tx.RollbackAsync(innerCt);
                throw;
            }
        }, ct);
    }
}
