namespace InventoryService.Application.Options;

/// <summary>
/// Legacy simulation mode kept only for development/demo fallback.
/// </summary>
public class InventoryOptions
{
    public const string SectionName = "Inventory";

    /// <summary>
    /// true: allow legacy aggregate-only simulation paths. Keep false for current warehouse/shelf scope.
    /// </summary>
    public bool SimulateWarehouse { get; set; } = false;
}
