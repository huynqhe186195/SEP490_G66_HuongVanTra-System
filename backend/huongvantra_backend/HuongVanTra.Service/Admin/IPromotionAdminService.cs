namespace HuongVanTra.Service.Admin {
    public interface IPromotionAdminService {
        Task<IReadOnlyList<PromotionAdminItemDto>> ListAsync(CancellationToken cancellationToken = default);
        Task<PromotionAdminItemDto?> GetAsync(int id, CancellationToken cancellationToken = default);
        Task<PromotionAdminItemDto> CreateAsync(UpsertPromotionRequest request, CancellationToken cancellationToken = default);
        Task<PromotionAdminItemDto?> UpdateAsync(int id, UpsertPromotionRequest request, CancellationToken cancellationToken = default);
        Task<PromotionAdminItemDto> DeactivateAsync(int id, CancellationToken cancellationToken = default);
        Task<PromotionAdminItemDto> ReactivateAsync(int id, CancellationToken cancellationToken = default);
    }
}
