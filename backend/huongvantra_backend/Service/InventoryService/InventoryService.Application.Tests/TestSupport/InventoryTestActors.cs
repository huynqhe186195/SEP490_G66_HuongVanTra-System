namespace InventoryService.Application.Tests.TestSupport;

public static class InventoryTestActors
{
    public static Guid Admin { get; } = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static Guid Manager { get; } = Guid.Parse("33333333-3333-3333-3333-333333333333");
    public static Guid Warehouse { get; } = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static Guid Sale { get; } = Guid.Parse("44444444-4444-4444-4444-444444444444");
}
