namespace InventoryService.Application.Options;

/// <summary>
/// Chế độ giả lập khi module kho tổng chưa vận hành đầy đủ.
/// </summary>
public class InventoryOptions
{
    public const string SectionName = "Inventory";

    /// <summary>
    /// true: duyệt nhập hàng chỉ cộng tồn cửa hàng, không trừ kho tổng; cho phép nhập tồn CH trực tiếp.
    /// </summary>
    public bool SimulateWarehouse { get; set; } = true;
}
