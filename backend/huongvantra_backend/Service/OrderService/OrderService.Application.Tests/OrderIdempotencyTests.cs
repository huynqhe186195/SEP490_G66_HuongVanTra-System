using System.Collections.Concurrent;
using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using OrderService.Domain.Rules;
using OrderService.Application.Tests.TestSupport;
using Xunit;

namespace OrderService.Application.Tests;

public class OrderIdempotencyTests
{
    [Fact]
    public void ActorScopedKey_ValidatesUuidAndFitsExistingColumn()
    {
        var actorId = Guid.NewGuid();
        var clientKey = Guid.NewGuid();

        var effectiveKey = OrderIdempotency.BuildActorScopedKey(clientKey.ToString("D"), actorId);

        Assert.Equal($"{actorId:N}:{clientKey:N}", effectiveKey);
        Assert.True(effectiveKey!.Length <= OrderIdempotency.MaxPersistedKeyLength);
        Assert.Throws<OrderValidationException>(
            () => OrderIdempotency.BuildActorScopedKey("not-a-uuid", actorId));
    }

    [Fact]
    public async Task SameActorAndKey_ReturnsExistingOrderWithoutDuplicateEvent()
    {
        var store = new ConcurrentOrderStore();
        var repository = new TestOrderRepository(store);
        var eventPublisher = new Mock<IOrderEventPublisher>();
        var logic = CreateLogic(repository, eventPublisher.Object);
        var actorId = Guid.NewGuid();
        var clientKey = Guid.NewGuid().ToString("D");

        var first = await logic.CreateAsync(
            CreateRequest(), Access(actorId), actorId, "Sale POS", clientKey);
        var retry = await logic.CreateAsync(
            CreateRequest(), Access(actorId), actorId, "Sale POS", clientKey);

        Assert.Equal(first.Id, retry.Id);
        Assert.Equal(1, store.Count);
        VerifyPlacedEvents(eventPublisher, Times.Once());
    }

    [Fact]
    public async Task SameActorAndDifferentKeys_CreateSeparateOrders()
    {
        var store = new ConcurrentOrderStore();
        var repository = new TestOrderRepository(store);
        var eventPublisher = new Mock<IOrderEventPublisher>();
        var logic = CreateLogic(repository, eventPublisher.Object);
        var actorId = Guid.NewGuid();

        var first = await logic.CreateAsync(
            CreateRequest(), Access(actorId), actorId, "Sale POS", Guid.NewGuid().ToString("D"));
        var second = await logic.CreateAsync(
            CreateRequest(), Access(actorId), actorId, "Sale POS", Guid.NewGuid().ToString("D"));

        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(2, store.Count);
        VerifyPlacedEvents(eventPublisher, Times.Exactly(2));
    }

    [Fact]
    public async Task DifferentActorsAndSameClientUuid_CreateIndependentOrders()
    {
        var store = new ConcurrentOrderStore();
        var repository = new TestOrderRepository(store);
        var eventPublisher = new Mock<IOrderEventPublisher>();
        var logic = CreateLogic(repository, eventPublisher.Object);
        var firstActor = Guid.NewGuid();
        var secondActor = Guid.NewGuid();
        var clientKey = Guid.NewGuid().ToString("D");

        var first = await logic.CreateAsync(
            CreateRequest(), Access(firstActor), firstActor, "Sale 1", clientKey);
        var second = await logic.CreateAsync(
            CreateRequest(), Access(secondActor), secondActor, "Sale 2", clientKey);

        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(2, store.Count);
        Assert.All(
            store.Orders,
            order => Assert.True(
                order.EmployeeId == firstActor || order.EmployeeId == secondActor));
    }

    [Fact]
    public async Task ConcurrentSameActorAndKey_CreatesOneOrderAndPublishesOneEvent()
    {
        var store = new ConcurrentOrderStore(expectedInitialLookups: 2);
        var firstRepository = new TestOrderRepository(store);
        var secondRepository = new TestOrderRepository(store);
        var eventPublisher = new Mock<IOrderEventPublisher>();
        var firstLogic = CreateLogic(firstRepository, eventPublisher.Object);
        var secondLogic = CreateLogic(secondRepository, eventPublisher.Object);
        var actorId = Guid.NewGuid();
        var clientKey = Guid.NewGuid().ToString("D");

        var results = await Task.WhenAll(
            firstLogic.CreateAsync(
                CreateRequest(), Access(actorId), actorId, "Sale POS", clientKey),
            secondLogic.CreateAsync(
                CreateRequest(), Access(actorId), actorId, "Sale POS", clientKey));

        Assert.Equal(results[0].Id, results[1].Id);
        Assert.Equal(1, store.Count);
        VerifyPlacedEvents(eventPublisher, Times.Once());
    }

    [Fact]
    public async Task ConcurrentPosSameActorAndKey_TriggersStockHandlingOnce()
    {
        var store = new ConcurrentOrderStore(expectedInitialLookups: 2);
        var inventoryCatalog = new Mock<IInventoryCatalogClient>();
        inventoryCatalog
            .Setup(client => client.PreparePosStockDeductionAsync(
                It.IsAny<InventoryStockHandlingRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((InventoryStockHandlingRequest request, CancellationToken _) =>
                new InventoryStockHandlingResponse(
                    request.OrderId,
                    request.OrderCode,
                    "FinishedGoods",
                    HasPendingStockReconciliation: false,
                    "Stock handled",
                    [],
                    []));
        var firstLogic = CreateLogic(
            new TestOrderRepository(store),
            new Mock<IOrderEventPublisher>().Object,
            inventoryCatalog.Object);
        var secondLogic = CreateLogic(
            new TestOrderRepository(store),
            new Mock<IOrderEventPublisher>().Object,
            inventoryCatalog.Object);
        var actorId = Guid.NewGuid();
        var clientKey = Guid.NewGuid().ToString("D");

        var results = await Task.WhenAll(
            firstLogic.CreateAsync(
                CreateRequest(OrderChannel.POS), Access(actorId), actorId, "Sale POS", clientKey),
            secondLogic.CreateAsync(
                CreateRequest(OrderChannel.POS), Access(actorId), actorId, "Sale POS", clientKey));

        Assert.Equal(results[0].Id, results[1].Id);
        Assert.Equal(1, store.Count);
        inventoryCatalog.Verify(
            client => client.PreparePosStockDeductionAsync(
                It.IsAny<InventoryStockHandlingRequest>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static OrderLogic CreateLogic(
        IOrderRepository repository,
        IOrderEventPublisher eventPublisher,
        IInventoryCatalogClient? inventoryCatalog = null)
    {
        var skuId = TestSkuId;
        var productCatalog = new Mock<IProductCatalogClient>();
        productCatalog
            .Setup(client => client.GetSkuProfilesAsync(
                It.IsAny<IEnumerable<Guid>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([new ProductSkuCatalogProfile(skuId, null, "Piece", "THANH_PHAM", true, false, false, true, 0m)]);

        var codeSequence = 0;
        var codeGenerator = new Mock<IOrderCodeGenerator>();
        codeGenerator
            .Setup(generator => generator.GenerateAsync(
                It.IsAny<OrderKind>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => $"IDEMP-{Interlocked.Increment(ref codeSequence):D6}");

        var promotionLogic = new PromotionLogic(
            new Mock<IPromotionRepository>().Object,
            new Mock<ICustomerCatalogClient>().Object);

        var shiftGuard = PosShiftTestDoubles.ShiftGuard();
        var posCashSessionLogic = PosShiftTestDoubles.CashSessionLogic(shiftGuard);
        return new OrderLogic(
            repository,
            new Mock<IReturnOrderRepository>().Object,
            new Mock<IPaymentRepository>().Object,
            codeGenerator.Object,
            eventPublisher,
            new Mock<IOrderActivityRepository>().Object,
            promotionLogic,
            productCatalog.Object,
            new Mock<ICustomerCatalogClient>().Object,
            new Mock<IContractCatalogClient>().Object,
            inventoryCatalog ?? new Mock<IInventoryCatalogClient>().Object,
            new Mock<ICustomBundleRepository>().Object,
            new Mock<IEmailService>().Object,
            posCashSessionLogic,
            shiftGuard,
            Microsoft.Extensions.Options.Options.Create(new SepayOptions()));
    }

    private static readonly Guid TestSkuId =
        Guid.Parse("aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa");

    private static CreateOrderRequest CreateRequest(
        OrderChannel orderChannel = OrderChannel.Website) =>
        new(
            CustomerId: null,
            CustomerSnapshotName: "Guest",
            EmployeeId: null,
            OrderChannel: orderChannel,
            ShippingAddress: orderChannel == OrderChannel.POS ? null : "1 Test Street",
            Note: "POS-10 regression",
            DiscountAmount: 0,
            Items:
            [
                new CreateOrderDetailRequest(
                    TestSkuId,
                    "Test SKU",
                    "TEST-SKU",
                    null,
                    Quantity: 1,
                    CostPrice: 0,
                    UnitPrice: 10_000)
            ],
            PaymentMethod: PaymentMethod.Cash,
            PaidAmount: 10_000);

    private static OrderAccessContext Access(Guid actorId) =>
        new(actorId, CanViewAllOrders: false, CanViewOwnOrders: true);

    private static void VerifyPlacedEvents(
        Mock<IOrderEventPublisher> publisher,
        Times times) =>
        publisher.Verify(
            item => item.PublishOrderPlacedAsync(
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<decimal>(),
                It.IsAny<IEnumerable<(Guid SkuId, string SkuName, string? SkuCode, int Quantity)>>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()),
            times);

    private sealed class ConcurrentOrderStore(int expectedInitialLookups = 0)
    {
        private readonly ConcurrentDictionary<string, Order> _orders = new();
        private readonly TaskCompletionSource _initialLookupsReleased =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _initialLookupCount;

        public int Count => _orders.Count;
        public IReadOnlyCollection<Order> Orders => _orders.Values.ToArray();

        public async Task<Order?> InitialLookupAsync(string key)
        {
            _orders.TryGetValue(key, out var snapshot);
            if (expectedInitialLookups <= 0)
                return snapshot;

            if (Interlocked.Increment(ref _initialLookupCount) >= expectedInitialLookups)
                _initialLookupsReleased.TrySetResult();

            await _initialLookupsReleased.Task;
            return snapshot;
        }

        public Order? Lookup(string key) =>
            _orders.TryGetValue(key, out var order) ? order : null;

        public bool TryClaim(Order order) =>
            _orders.TryAdd(order.IdempotencyKey!, order);
    }

    private sealed class TestOrderRepository(ConcurrentOrderStore store) : IOrderRepository
    {
        private Order? _pending;
        private Guid? _claimedOrderId;
        private bool _initialLookupCompleted;

        public async Task<Order?> GetByIdempotencyKeyAsync(
            string key,
            CancellationToken ct = default)
        {
            if (!_initialLookupCompleted)
            {
                _initialLookupCompleted = true;
                return await store.InitialLookupAsync(key);
            }

            return store.Lookup(key);
        }

        public Task AddAsync(Order order, CancellationToken ct = default)
        {
            _pending = order;
            _claimedOrderId = null;
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            if (_pending?.IdempotencyKey is null || _claimedOrderId == _pending.Id)
                return Task.FromResult(0);

            if (!store.TryClaim(_pending))
            {
                throw new DuplicateOrderIdempotencyKeyException(
                    new InvalidOperationException("Simulated unique index conflict."));
            }

            _claimedOrderId = _pending.Id;
            return Task.FromResult(1);
        }

        public Task<Order?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            Task.FromResult(store.Orders.FirstOrDefault(order => order.Id == id));

        public Task<Order?> GetByCodeAsync(string orderCode, CancellationToken ct = default) =>
            Task.FromResult(store.Orders.FirstOrDefault(order => order.OrderCode == orderCode));

        public Task<(List<Order> Items, int TotalCount)> GetPagedAsync(
            string? search, Guid? customerId, string? status, string? channel,
            string? excludeChannel, string? codTab, bool returnableOnly,
            string? orderKind, string? excludeOrderKind,
            DateTime? fromDate, DateTime? toDate, Guid? employeeId,
            bool includeAllCodOrders, int page, int pageSize,
            CancellationToken ct = default,
            IReadOnlyCollection<Guid>? restrictToOrderIds = null) =>
            throw new NotSupportedException();

        public Task<(List<Order> Items, int TotalCount)> GetB2BDebtsAsync(
            Guid? customerId, bool overdueOnly, DateTime today,
            int page, int pageSize, CancellationToken ct = default) =>
            throw new NotSupportedException();

        public Task<List<Order>> GetPendingCodAsync(CancellationToken ct = default) =>
            throw new NotSupportedException();

        public Task<Order?> GetSinglePendingTransferByAmountAsync(
            decimal amount,
            int toleranceVnd,
            CancellationToken ct = default) =>
            throw new NotSupportedException();

        public Task<Order?> GetLatestPendingTransferAsync(
            DateTime utcNow,
            CancellationToken ct = default) =>
            throw new NotSupportedException();

        public Task<bool> TryTransitionStatusAsync(
            Guid orderId,
            OrderStatus expectedStatus,
            OrderStatus nextStatus,
            CancellationToken ct = default)
        {
            var order = store.Orders.FirstOrDefault(item =>
                item.Id == orderId && item.OrderStatus == expectedStatus);
            if (order is null) return Task.FromResult(false);
            order.OrderStatus = nextStatus;
            return Task.FromResult(true);
        }
    }
}
