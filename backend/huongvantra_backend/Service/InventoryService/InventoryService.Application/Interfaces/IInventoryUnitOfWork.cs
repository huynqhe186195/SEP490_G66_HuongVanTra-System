namespace InventoryService.Application.Interfaces;

public interface IInventoryUnitOfWork
{
    Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action, CancellationToken ct = default);
}
