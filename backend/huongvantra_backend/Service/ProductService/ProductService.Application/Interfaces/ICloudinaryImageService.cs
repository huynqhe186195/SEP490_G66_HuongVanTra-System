namespace ProductService.Application.Interfaces;

public interface ICloudinaryImageService
{
    // Best-effort xóa ảnh khỏi Cloudinary theo secure_url. Không throw khi lỗi.
    Task DeleteByUrlsAsync(IEnumerable<string> imageUrls, CancellationToken ct = default);
}
