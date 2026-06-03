namespace HuongVanTra.Service.Orders {
    public interface IOrderAccessResolver {
        Task<OrderAccessScope> ResolveAsync(
            IEnumerable<string> roles,
            int? employeeId,
            CancellationToken cancellationToken = default);
    }
}
