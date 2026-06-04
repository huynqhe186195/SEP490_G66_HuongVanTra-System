using System.Text.Json;
using HuongVanTra.Core.Constants;
using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Sales;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HuongVanTra.Service.Orders {
    public class OrderService : IOrderService {
        private readonly AppDbContext _dbContext;
        private readonly IVietQrService _vietQrService;
        private readonly ISepayOrderVaService _sepayOrderVaService;
        private readonly SepaySettings _sepaySettings;

        public OrderService(
            AppDbContext dbContext,
            IVietQrService vietQrService,
            ISepayOrderVaService sepayOrderVaService,
            IOptions<SepaySettings> sepayOptions) {
            _dbContext = dbContext;
            _vietQrService = vietQrService;
            _sepayOrderVaService = sepayOrderVaService;
            _sepaySettings = sepayOptions.Value;
        }

        public async Task<PagedResult<OrderListItemDto>> GetOrdersAsync(OrderQuery query, CancellationToken cancellationToken = default) {
            var page = query.Page < 1 ? 1 : query.Page;
            var pageSize = query.PageSize < 1 ? 20 : Math.Min(query.PageSize, 100);

            var access = query.Access ?? OrderAccessScope.AllOrders();

            var ordersQuery = _dbContext.Orders
                .AsNoTracking()
                .Include(o => o.Customer)
                .Include(o => o.Cashier)
                .Include(o => o.PaymentTransactions)
                .AsQueryable();

            ordersQuery = OrderAccessScope.ApplyFilter(ordersQuery, access);

            if (!string.IsNullOrWhiteSpace(query.Search)) {
                var term = query.Search.Trim();
                ordersQuery = ordersQuery.Where(o =>
                    o.OrderCode.Contains(term) ||
                    (o.Customer != null && o.Customer.CustomerCode.Contains(term)) ||
                    (o.Customer != null && o.Customer.Phone != null && o.Customer.Phone.Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(query.OrderStatus)) {
                var status = query.OrderStatus.Trim().ToLowerInvariant();
                ordersQuery = ordersQuery.Where(o => o.OrderStatus.ToLower() == status);
            }

            if (!string.IsNullOrWhiteSpace(query.PaymentStatus)) {
                var paymentStatus = query.PaymentStatus.Trim().ToLowerInvariant();
                ordersQuery = ordersQuery.Where(o => o.PaymentStatus.ToLower() == paymentStatus);
            }

            if (!string.IsNullOrWhiteSpace(query.PaymentMethod)) {
                var method = query.PaymentMethod.Trim().ToUpperInvariant();
                ordersQuery = ordersQuery.Where(o => o.PaymentMethod.ToUpper() == method);
            }

            if (access.Mode == OrderAccessMode.Own && access.EmployeeId.HasValue) {
                ordersQuery = ordersQuery.Where(o => o.CashierId == access.EmployeeId.Value);
            } else if (query.CashierId.HasValue) {
                ordersQuery = ordersQuery.Where(o => o.CashierId == query.CashierId.Value);
            }

            if (query.FromDate.HasValue) {
                ordersQuery = ordersQuery.Where(o => o.CreatedAt >= query.FromDate.Value);
            }

            if (query.ToDate.HasValue) {
                var toExclusive = query.ToDate.Value.Date.AddDays(1);
                ordersQuery = ordersQuery.Where(o => o.CreatedAt < toExclusive);
            }

            var totalCount = await ordersQuery.CountAsync(cancellationToken);

            var items = await ordersQuery
                .OrderByDescending(o => o.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(o => new OrderListItemDto {
                    Id = o.Id,
                    OrderCode = o.OrderCode,
                    CustomerName = o.Customer != null
                        ? (string.IsNullOrWhiteSpace(o.Customer.FullName) ? o.Customer.CustomerCode : o.Customer.FullName)
                        : "Khách lẻ",
                    CustomerPhone = o.Customer != null ? o.Customer.Phone : null,
                    PaymentMethod = o.PaymentMethod,
                    OrderStatus = o.OrderStatus,
                    PaymentStatus = o.PaymentStatus,
                    ShippingAddress = o.ShippingAddress,
                    TotalAmount = o.TotalAmount,
                    CashierId = o.CashierId,
                    CashierName = o.Cashier.FullName,
                    CreatedAt = o.CreatedAt,
                })
                .ToListAsync(cancellationToken);

            return new PagedResult<OrderListItemDto> {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
            };
        }

        public async Task<List<OrderCreatorOptionDto>> GetOrderCreatorsAsync(
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            var ordersQuery = OrderAccessScope.ApplyFilter(_dbContext.Orders.AsNoTracking(), access);

            return await _dbContext.Set<Employee>()
                .AsNoTracking()
                .Where(e => ordersQuery.Any(o => o.CashierId == e.Id))
                .OrderBy(e => e.FullName)
                .Select(e => new OrderCreatorOptionDto {
                    Id = e.Id,
                    FullName = e.FullName,
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<OrderDetailDto?> GetOrderAsync(
            string idOrCode,
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            var order = await ResolveOrderAsync(idOrCode, cancellationToken);
            if (order is null || !OrderAccessScope.CanAccess(order, access)) {
                return null;
            }

            var dto = MapToDetail(order);
            dto.StockShortages = await LoadStockShortagesAsync(order.Id, cancellationToken);
            return dto;
        }

        public async Task<OrderDetailDto?> UpdateOrderStatusAsync(
            int id,
            UpdateOrderStatusRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            access.EnsureCanEdit();

            if (!OrderStatuses.IsValid(request.OrderStatus)) {
                throw new ArgumentException("Invalid order status.");
            }

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null || !OrderAccessScope.CanAccess(order, access)) {
                return null;
            }

            OrderAccessScope.EnsureEditable(order);

            order.OrderStatus = request.OrderStatus.Trim().ToLowerInvariant();

            if (!string.IsNullOrWhiteSpace(request.PaymentStatus)) {
                order.PaymentStatus = request.PaymentStatus.Trim().ToLowerInvariant();
            }

            if (!string.IsNullOrWhiteSpace(request.StockStatus)) {
                order.StockStatus = request.StockStatus.Trim().ToLowerInvariant();
            }

            order.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);

            return MapToDetail(order);
        }

        public async Task<OrderDetailDto?> ApplyCouponAsync(
            int id,
            ApplyCouponRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            access.EnsureCanEdit();

            if (string.IsNullOrWhiteSpace(request.PromoCode)) {
                throw new ArgumentException("Promo code is required.");
            }

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null || !OrderAccessScope.CanAccess(order, access)) {
                return null;
            }

            OrderAccessScope.EnsureEditable(order);

            if (string.Equals(order.PaymentStatus, PaymentStatus.Paid, StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException("Cannot apply coupon after payment is completed.");
            }

            var promoCode = request.PromoCode.Trim().ToUpperInvariant();
            var promotion = await _dbContext.OrderPromotions
                .FirstOrDefaultAsync(p => p.PromoCode.ToUpper() == promoCode, cancellationToken);

            if (promotion is null) {
                throw new ArgumentException("Coupon not found.");
            }

            PromotionValidity.EnsureUsable(promotion);

            order.PromotionId = promotion.Id;
            order.Promotion = promotion;
            RecalculateTotals(order);
            order.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapToDetail(order);
        }

        public async Task<OrderDetailDto?> AddGiftItemAsync(
            int id,
            AddGiftItemRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            access.EnsureCanEdit();

            if (request.ProductId <= 0 || request.Quantity <= 0) {
                throw new ArgumentException("Invalid gift item.");
            }

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null || !OrderAccessScope.CanAccess(order, access)) {
                return null;
            }

            OrderAccessScope.EnsureEditable(order);

            var product = await _dbContext.Products
                .FirstOrDefaultAsync(p => p.Id == request.ProductId, cancellationToken);
            if (product is null) {
                throw new ArgumentException("Product not found.");
            }

            order.OrderItems.Add(new OrderItem {
                ProductId = product.Id,
                ProductName = product.Name,
                Sku = product.Sku,
                UnitPrice = product.Price,
                Quantity = request.Quantity,
                LineTotal = 0,
                IsGift = 1,
            });

            RecalculateTotals(order);
            order.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);

            order = await LoadOrderGraphAsync(id, cancellationToken, tracking: false);
            return order is null ? null : MapToDetail(order);
        }

        public async Task<OrderDetailDto?> UpdateAdjustmentsAsync(
            int id,
            UpdateOrderAdjustmentsRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            access.EnsureCanEdit();

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null || !OrderAccessScope.CanAccess(order, access)) {
                return null;
            }

            OrderAccessScope.EnsureEditable(order);

            if (request.ManualDiscount.HasValue) {
                if (request.ManualDiscount.Value < 0) {
                    throw new ArgumentException("Manual discount cannot be negative.");
                }

                var subtotal = order.OrderItems.Sum(i => i.LineTotal);
                if (request.ManualDiscount.Value > subtotal) {
                    throw new ArgumentException("Manual discount cannot exceed order subtotal.");
                }

                order.ManualDiscount = request.ManualDiscount.Value;
            }

            if (request.DeductAmount.HasValue) {
                if (request.DeductAmount.Value < 0) {
                    throw new ArgumentException("Deduct amount cannot be negative.");
                }

                order.DeductAmount = request.DeductAmount.Value;
            }

            if (request.Notes is not null) {
                order.Notes = request.Notes.Trim();
            }

            if (request.ShippingAddress is not null) {
                order.ShippingAddress = string.IsNullOrWhiteSpace(request.ShippingAddress)
                    ? null
                    : request.ShippingAddress.Trim();
            }

            if (request.RequestStockDeduct && order.StockDeductQueue is null) {
                order.StockDeductQueue = new StockDeductQueue {
                    OrderId = order.Id,
                    Status = "PENDING",
                    BomSnapshot = "{}",
                    CreatedAt = DateTime.UtcNow,
                };
                order.StockStatus = "QUEUED";
            }

            RecalculateTotals(order);
            order.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapToDetail(order);
        }

        public async Task<OrderDetailDto?> UpdateOrderItemsAsync(
            int id,
            UpdateOrderItemsRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            access.EnsureCanEdit();

            if (request.Items is null || request.Items.Count == 0) {
                throw new ArgumentException("At least one order line is required.");
            }

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null || !OrderAccessScope.CanAccess(order, access)) {
                return null;
            }

            EnsureOrderItemsEditable(order);
            var normalizedLines = NormalizeItemLines(request.Items);

            var productIds = normalizedLines.Select(l => l.ProductId).Distinct().ToList();
            var products = await _dbContext.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, cancellationToken);

            if (products.Count != productIds.Count) {
                throw new ArgumentException("One or more products were not found.");
            }

            await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
            try {
                var warehouse = await _dbContext.Warehouses
                    .FirstOrDefaultAsync(w => w.StoreId == order.StoreId, cancellationToken)
                    ?? throw new InvalidOperationException($"No warehouse found for store {order.StoreId}.");

                var queue = order.StockDeductQueue;
                var wasStockDeducted = string.Equals(order.StockStatus, OrderStockStatus.Deducted, StringComparison.OrdinalIgnoreCase)
                    || (queue is not null && queue.Status == QueueStatus.Confirmed);

                if (wasStockDeducted && queue is not null && queue.Status == QueueStatus.Confirmed) {
                    await ReverseInventoryAsync(order, queue, warehouse.Id, order.CashierId, cancellationToken);
                }

                _dbContext.OrderItems.RemoveRange(order.OrderItems);
                order.OrderItems.Clear();

                foreach (var line in normalizedLines) {
                    var product = products[line.ProductId];
                    var isGift = line.IsGift != 0;
                    var unitPrice = product.Price;
                    order.OrderItems.Add(new OrderItem {
                        ProductId = product.Id,
                        ProductName = product.Name,
                        Sku = product.Sku,
                        UnitPrice = unitPrice,
                        Quantity = line.Quantity,
                        LineTotal = isGift ? 0 : unitPrice * line.Quantity,
                        IsGift = isGift ? (byte)1 : (byte)0,
                    });
                }

                var totalBeforeItems = order.TotalAmount;
                RecalculateTotals(order);
                SyncPendingPaymentAmounts(order);

                if (Math.Round(order.TotalAmount, 0, MidpointRounding.AwayFromZero)
                    != Math.Round(totalBeforeItems, 0, MidpointRounding.AwayFromZero)) {
                    order.Notes = SepayOrderNotes.StripPaymentMetadata(order.Notes);
                }

                if (wasStockDeducted) {
                    var snapshot = await BuildBomSnapshotAsync(order.OrderItems, cancellationToken);
                    if (queue is not null) {
                        queue.BomSnapshot = JsonSerializer.Serialize(snapshot);
                        queue.Status = QueueStatus.Confirmed;
                    }

                    await DeductInventoryAsync(order, warehouse.Id, order.CashierId, cancellationToken);
                    order.StockStatus = OrderStockStatus.Deducted;
                } else if (queue is not null && queue.Status == QueueStatus.Waiting) {
                    var snapshot = await BuildBomSnapshotAsync(order.OrderItems, cancellationToken);
                    queue.BomSnapshot = JsonSerializer.Serialize(snapshot);
                }

                order.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);

                return MapToDetail(order);
            } catch {
                await tx.RollbackAsync(cancellationToken);
                throw;
            }
        }

        private static void EnsureOrderItemsEditable(Order order) {
            OrderAccessScope.EnsureEditable(order);
        }

        private static List<UpdateOrderItemLineRequest> NormalizeItemLines(List<UpdateOrderItemLineRequest> items) {
            foreach (var item in items) {
                if (item.ProductId <= 0 || item.Quantity <= 0) {
                    throw new ArgumentException("Each line must have a valid product and positive quantity.");
                }
            }

            return items
                .GroupBy(i => (i.ProductId, i.IsGift))
                .Select(g => new UpdateOrderItemLineRequest {
                    ProductId = g.Key.ProductId,
                    IsGift = g.Key.IsGift,
                    Quantity = g.Sum(x => x.Quantity),
                })
                .ToList();
        }

        private static void SyncPendingPaymentAmounts(Order order) {
            foreach (var txn in order.PaymentTransactions) {
                if (!string.Equals(txn.Status, PaymentStatus.Paid, StringComparison.OrdinalIgnoreCase)) {
                    txn.Amount = order.TotalAmount;
                }
            }
        }

        private const int PaymentQrCooldownSeconds = 30;

        public async Task<OrderPaymentQrDto?> GetOrderPaymentQrAsync(
            int id,
            OrderAccessScope access,
            bool forceRegenerate = false,
            CancellationToken cancellationToken = default) {
            access.EnsureCanEdit();

            var order = await _dbContext.Orders
                .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

            if (order is null || !OrderAccessScope.CanAccess(order, access)) {
                return null;
            }

            OrderAccessScope.EnsureEditable(order);

            if (string.Equals(order.PaymentStatus, PaymentStatus.Paid, StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException("Order is already paid.");
            }

            if (string.Equals(order.OrderStatus, OrderStatus.Cancelled, StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException("Cancelled orders cannot generate payment QR.");
            }

            var method = order.PaymentMethod.Trim().ToUpperInvariant();
            if (method is not "VIETQR" and not "TRANSFER") {
                throw new InvalidOperationException(
                    $"Payment QR is only available for VietQR/transfer orders (current: {order.PaymentMethod}).");
            }

            if (order.TotalAmount <= 0) {
                throw new InvalidOperationException("Order total must be greater than zero.");
            }

            var parsed = SepayOrderNotes.TryParse(order.Notes);
            var canReuseVa = parsed is not null && SepayOrderNotes.CanReuseVa(parsed, order.TotalAmount);
            var qrWasExpired = parsed is not null && SepayOrderNotes.IsQrExpired(parsed);
            var orderDuration = _sepaySettings.VaDurationSeconds > 0 ? _sepaySettings.VaDurationSeconds : 86400;

            if (canReuseVa && !forceRegenerate && parsed!.QrGeneratedAt.HasValue) {
                var elapsed = DateTime.UtcNow - parsed.QrGeneratedAt.Value;
                if (elapsed.TotalSeconds < PaymentQrCooldownSeconds) {
                    return PopulatePaymentQrDto(
                        order,
                        _sepayOrderVaService.ResolveQrForExistingVa(
                            order.OrderCode,
                            parsed.VaNumber,
                            order.TotalAmount,
                            parsed.SepayOrderId),
                        parsed,
                        reusedExistingVa: true,
                        createdNewVa: false,
                        hint: $"Đang dùng VA hiện tại. Thử lại sau {PaymentQrCooldownSeconds - (int)elapsed.TotalSeconds} giây nếu cần làm mới ảnh QR.");
                }
            }

            SepayOrderVaResult sepayVa;
            var createdNewVa = false;
            var reusedExistingVa = false;

            if (canReuseVa && parsed is not null) {
                sepayVa = _sepayOrderVaService.ResolveQrForExistingVa(
                    order.OrderCode,
                    parsed.VaNumber,
                    order.TotalAmount,
                    parsed.SepayOrderId);
                reusedExistingVa = true;
            } else {
                sepayVa = await _sepayOrderVaService.CreateOrderVaForTransferAsync(
                    order.OrderCode,
                    order.TotalAmount,
                    orderDuration,
                    cancellationToken);
                createdNewVa = true;
            }

            if (createdNewVa) {
                var remainingNote = SepayOrderNotes.StripPaymentMetadata(order.Notes);
                var paymentNote = SepayOrderNotes.Build(
                    sepayVa.VaNumber,
                    order.TotalAmount,
                    sepayVa.SepayOrderId,
                    orderDuration);
                order.Notes = string.IsNullOrWhiteSpace(remainingNote)
                    ? paymentNote
                    : $"{remainingNote}; {paymentNote}";

                order.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            var refreshedParsed = SepayOrderNotes.TryParse(order.Notes) ?? parsed;

            return PopulatePaymentQrDto(
                order,
                sepayVa,
                refreshedParsed,
                reusedExistingVa,
                createdNewVa,
                qrWasExpired && createdNewVa
                    ? "QR/VA đã hết hạn. Đã tạo VA mới."
                    : reusedExistingVa
                        ? "Dùng lại VA đã tạo cho đơn này (không tạo thêm trên SePay)."
                        : createdNewVa
                            ? "Đã tạo VA mới vì tổng tiền thay đổi, hết hạn hoặc chưa có VA."
                            : null);
        }

        public async Task<OrderPaymentStatusDto?> GetOrderPaymentStatusAsync(
            int id,
            OrderAccessScope access,
            CancellationToken cancellationToken = default) {
            var order = await _dbContext.Orders
                .AsNoTracking()
                .Where(o => o.Id == id)
                .Select(o => new {
                    o.Id,
                    o.OrderCode,
                    o.PaymentStatus,
                    o.OrderStatus,
                    o.TotalAmount,
                    o.StoreId,
                    o.CashierId,
                    InvoiceCode = _dbContext.Invoices
                        .Where(i => i.OrderId == o.Id)
                        .OrderByDescending(i => i.Id)
                        .Select(i => i.InvoiceCode)
                        .FirstOrDefault(),
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (order is null) {
                return null;
            }

            var scopeOrder = new Order {
                Id = order.Id,
                StoreId = order.StoreId,
                CashierId = order.CashierId,
            };
            if (!OrderAccessScope.CanAccess(scopeOrder, access)) {
                return null;
            }

            var isPaid = string.Equals(order.PaymentStatus, PaymentStatus.Paid, StringComparison.OrdinalIgnoreCase);
            return new OrderPaymentStatusDto {
                OrderId = order.Id,
                OrderCode = order.OrderCode,
                PaymentStatus = order.PaymentStatus,
                OrderStatus = order.OrderStatus,
                IsPaid = isPaid,
                InvoiceCode = order.InvoiceCode,
                ExpectedTransferContent = BuildExpectedTransferContent(order.OrderCode),
                ExpectedAmount = order.TotalAmount,
            };
        }

        private static string BuildExpectedTransferContent(string orderCode) {
            var cleaned = orderCode.Trim().ToUpperInvariant();
            cleaned = new string(cleaned.Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
            return cleaned.Length <= 25 ? cleaned : cleaned[..25];
        }

        private OrderPaymentQrDto PopulatePaymentQrDto(
            Order order,
            SepayOrderVaResult sepayVa,
            SepayOrderNotes.Parsed? parsedNotes,
            bool reusedExistingVa,
            bool createdNewVa,
            string? hint) {
            var dto = new OrderPaymentQrDto {
                OrderId = order.Id,
                OrderCode = order.OrderCode,
                TotalAmount = order.TotalAmount,
                PaymentMethod = order.PaymentMethod,
                TransferAccountNumber = sepayVa.VaNumber,
                PaymentMode = sepayVa.PaymentMode,
                ReusedExistingVa = reusedExistingVa,
                CreatedNewVa = createdNewVa,
                Hint = hint,
                QrExpiresAtUtc = parsedNotes?.QrExpiresAt ?? sepayVa.ExpiresAtUtc,
            };

            if (!string.IsNullOrWhiteSpace(sepayVa.QrImageUrl)) {
                dto.QrImageUrl = sepayVa.QrImageUrl;
                dto.QrPayload = sepayVa.QrPayload;
                dto.TransferContent = order.OrderCode;
                return dto;
            }

            var qr = _vietQrService.GenerateForAccount(
                sepayVa.VaNumber,
                order.OrderCode,
                order.TotalAmount);
            dto.QrImageUrl = qr.QrImageUrl;
            dto.QrPayload = qr.QrPayload;
            dto.TransferContent = qr.TransferContent;
            return dto;
        }

        private async Task<List<BomSnapshotEntry>> BuildBomSnapshotAsync(
            ICollection<OrderItem> items,
            CancellationToken cancellationToken) {
            var productIds = items.Where(i => i.IsGift == 0).Select(i => i.ProductId).Distinct().ToList();
            var bomHeaders = await _dbContext.BomHeaders
                .Include(b => b.BomLines)
                .Where(b => productIds.Contains(b.FinishedGoodId))
                .ToListAsync(cancellationToken);

            var snapshot = new List<BomSnapshotEntry>();
            foreach (var item in items.Where(i => i.IsGift == 0)) {
                var bom = bomHeaders.FirstOrDefault(b => b.FinishedGoodId == item.ProductId);
                if (bom is not null && bom.BomLines.Count > 0) {
                    var multiplier = item.Quantity / bom.QuantityOutput;
                    foreach (var line in bom.BomLines) {
                        snapshot.Add(new BomSnapshotEntry {
                            ProductId = item.ProductId,
                            MaterialId = line.MaterialId,
                            Quantity = line.Quantity * multiplier,
                        });
                    }
                } else {
                    snapshot.Add(new BomSnapshotEntry {
                        ProductId = item.ProductId,
                        MaterialId = item.ProductId,
                        Quantity = item.Quantity,
                    });
                }
            }

            if (snapshot.Count == 0) {
                throw new InvalidOperationException("No inventory items to deduct for this order.");
            }

            return snapshot;
        }

        private async Task DeductInventoryAsync(
            Order order,
            int warehouseId,
            int cashierId,
            CancellationToken cancellationToken) {
            var productIds = order.OrderItems
                .Where(i => i.IsGift == 0)
                .Select(i => i.ProductId)
                .Distinct()
                .ToList();

            var bomHeaders = await _dbContext.BomHeaders
                .Include(b => b.BomLines)
                .Where(b => productIds.Contains(b.FinishedGoodId))
                .ToDictionaryAsync(b => b.FinishedGoodId, cancellationToken);

            var deductMap = new Dictionary<int, decimal>();
            foreach (var item in order.OrderItems.Where(i => i.IsGift == 0)) {
                if (bomHeaders.TryGetValue(item.ProductId, out var bom) && bom.BomLines.Count > 0) {
                    var multiplier = item.Quantity / bom.QuantityOutput;
                    foreach (var line in bom.BomLines) {
                        deductMap.TryGetValue(line.MaterialId, out var existing);
                        deductMap[line.MaterialId] = existing + line.Quantity * multiplier;
                    }
                } else {
                    deductMap.TryGetValue(item.ProductId, out var existing);
                    deductMap[item.ProductId] = existing + item.Quantity;
                }
            }

            if (deductMap.Count == 0) {
                throw new InvalidOperationException("No inventory items to deduct for this order.");
            }

            var materialIds = deductMap.Keys.ToList();
            var balances = await _dbContext.InventoryBalances
                .Where(b => b.WarehouseId == warehouseId && materialIds.Contains(b.ProductId))
                .ToDictionaryAsync(b => b.ProductId, cancellationToken);

            var txnCode = $"TXN-{order.OrderCode}";

            foreach (var (materialId, qty) in deductMap) {
                if (!balances.TryGetValue(materialId, out var balance)) {
                    balance = new InventoryBalance {
                        WarehouseId = warehouseId,
                        ProductId = materialId,
                        Quantity = 0,
                    };
                    _dbContext.InventoryBalances.Add(balance);
                    await _dbContext.SaveChangesAsync(cancellationToken);
                    balances[materialId] = balance;
                }

                var before = balance.Quantity;
                var after = before - qty;

                if (after < 0) {
                    throw new InvalidOperationException(
                        $"Insufficient stock for product {materialId}: available {before}, required {qty}.");
                }

                balance.Quantity = after;

                _dbContext.InventoryTransactions.Add(new InventoryTransaction {
                    TxnCode = $"{txnCode}-{materialId}",
                    WarehouseId = warehouseId,
                    ProductId = materialId,
                    TxnType = "OUT",
                    Quantity = qty,
                    QuantityBefore = before,
                    QuantityAfter = after,
                    RefType = "ORDER",
                    RefId = order.Id,
                    CreatedById = cashierId,
                    CreatedAt = DateTime.UtcNow,
                });
            }
        }

        private async Task ReverseInventoryAsync(
            Order order,
            StockDeductQueue queue,
            int warehouseId,
            int employeeId,
            CancellationToken cancellationToken) {
            var snapshot = JsonSerializer.Deserialize<List<BomSnapshotEntry>>(queue.BomSnapshot) ?? new();

            var deductMap = snapshot
                .GroupBy(e => e.MaterialId)
                .ToDictionary(g => g.Key, g => g.Sum(e => e.Quantity));

            if (deductMap.Count == 0) {
                return;
            }

            var materialIds = deductMap.Keys.ToList();
            var balances = await _dbContext.InventoryBalances
                .Where(b => b.WarehouseId == warehouseId && materialIds.Contains(b.ProductId))
                .ToDictionaryAsync(b => b.ProductId, cancellationToken);

            var txnCode = $"REV-{order.OrderCode}";
            foreach (var (materialId, qty) in deductMap) {
                if (!balances.TryGetValue(materialId, out var balance)) {
                    balance = new InventoryBalance {
                        WarehouseId = warehouseId,
                        ProductId = materialId,
                        Quantity = 0,
                    };
                    _dbContext.InventoryBalances.Add(balance);
                    await _dbContext.SaveChangesAsync(cancellationToken);
                    balances[materialId] = balance;
                }

                var before = balance.Quantity;
                var after = before + qty;
                balance.Quantity = after;

                _dbContext.InventoryTransactions.Add(new InventoryTransaction {
                    TxnCode = $"{txnCode}-{materialId}",
                    WarehouseId = warehouseId,
                    ProductId = materialId,
                    TxnType = "IN",
                    Quantity = qty,
                    QuantityBefore = before,
                    QuantityAfter = after,
                    RefType = "ORDER_ADJUST",
                    RefId = order.Id,
                    CreatedById = employeeId,
                    CreatedAt = DateTime.UtcNow,
                });
            }
        }

        private async Task<Order?> ResolveOrderAsync(string idOrCode, CancellationToken cancellationToken, bool tracking = false) {
            if (string.IsNullOrWhiteSpace(idOrCode)) {
                return null;
            }

            var normalized = idOrCode.Trim().TrimStart('#');

            if (int.TryParse(normalized, out var id)) {
                return await LoadOrderGraphAsync(id, cancellationToken, tracking);
            }

            var query = BuildOrderGraphQuery(tracking);
            return await query.FirstOrDefaultAsync(
                o => o.OrderCode == normalized || o.OrderCode == $"HV{normalized}",
                cancellationToken);
        }

        private async Task<Order?> LoadOrderGraphAsync(int id, CancellationToken cancellationToken, bool tracking = false) {
            var query = BuildOrderGraphQuery(tracking);
            return await query.FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        }

        private IQueryable<Order> BuildOrderGraphQuery(bool tracking) {
            var query = _dbContext.Orders
                .Include(o => o.Customer)
                .Include(o => o.Cashier)
                .Include(o => o.Promotion)
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.Product)
                .Include(o => o.PaymentTransactions)
                .Include(o => o.StockDeductQueue);

            return tracking ? query : query.AsNoTracking();
        }

        private static void RecalculateTotals(Order order) {
            order.SubTotal = order.OrderItems.Sum(i => i.LineTotal);

            var afterManual = Math.Max(0, order.SubTotal - order.ManualDiscount - order.DeductAmount);

            order.CouponDiscount = 0;
            if (order.Promotion is not null) {
                order.CouponDiscount = order.Promotion.DiscountType.Equals("FIXED", StringComparison.OrdinalIgnoreCase)
                    ? Math.Min(order.Promotion.DiscountValue, afterManual)
                    : Math.Round(afterManual * order.Promotion.DiscountValue / 100m, 2);
            }

            order.TotalAmount = Math.Max(0, afterManual - order.CouponDiscount);
        }

        private async Task<List<OrderStockShortageDto>> LoadStockShortagesAsync(
            int orderId, CancellationToken cancellationToken) {
            return await _dbContext.OrderStockShortages
                .AsNoTracking()
                .Where(s => s.OrderId == orderId && s.Status == ShortageStatus.WaitingStock)
                .Join(
                    _dbContext.Products.AsNoTracking(),
                    s => s.MaterialId,
                    p => p.Id,
                    (s, p) => new OrderStockShortageDto {
                        MaterialId         = s.MaterialId,
                        MaterialName       = p.Name,
                        RequiredQuantity   = s.RequiredQuantity,
                        AvailableQuantity  = s.AvailableQuantity,
                        ShortageQuantity   = s.ShortageQuantity,
                        Status             = s.Status,
                    })
                .ToListAsync(cancellationToken);
        }

        private static OrderDetailDto MapToDetail(Order order) {
            return new OrderDetailDto {
                Id = order.Id,
                OrderCode = order.OrderCode,
                StoreId = order.StoreId,
                CustomerId = order.CustomerId,
                CustomerName = order.Customer?.CustomerCode ?? "Khách lẻ",
                CustomerPhone = order.Customer?.Phone,
                CashierName = order.Cashier.FullName,
                OrderStatus = order.OrderStatus,
                PaymentStatus = order.PaymentStatus,
                PaymentMethod = order.PaymentMethod,
                ShippingAddress = order.ShippingAddress,
                StockStatus = order.StockStatus,
                SubTotal = order.SubTotal,
                CouponDiscount = order.CouponDiscount,
                ManualDiscount = order.ManualDiscount,
                DeductAmount = order.DeductAmount,
                TotalAmount = order.TotalAmount,
                Notes = order.Notes,
                Promotion = order.Promotion is null ? null : new OrderPromotionDto {
                    Id = order.Promotion.Id,
                    PromoCode = order.Promotion.PromoCode,
                    DiscountType = order.Promotion.DiscountType,
                    DiscountValue = order.Promotion.DiscountValue,
                    ValidFromUtc = order.Promotion.ValidFromUtc,
                    ValidToUtc = order.Promotion.ValidToUtc,
                },
                Items = order.OrderItems.Select(i => new OrderItemDto {
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductName = i.ProductName,
                    ProductSku = string.IsNullOrEmpty(i.Sku) ? i.Product.Sku : i.Sku,
                    UnitPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                    LineTotal = i.LineTotal,
                    IsGift = i.IsGift == 1,
                }).ToList(),
                Payments = order.PaymentTransactions
                    .OrderByDescending(p => p.TransactionDate)
                    .Select(p => new PaymentTransactionDto {
                        Id = p.Id,
                        PaymentMethod = p.PaymentMethod,
                        Amount = p.Amount,
                        TransactionDate = p.TransactionDate,
                    }).ToList(),
                StockDeductQueue = order.StockDeductQueue is null ? null : new StockDeductQueueDto {
                    Id = order.StockDeductQueue.Id,
                    Status = order.StockDeductQueue.Status,
                    CreatedAt = order.StockDeductQueue.CreatedAt,
                },
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,
            };
        }

        private class BomSnapshotEntry {
            public int ProductId { get; set; }
            public int MaterialId { get; set; }
            public decimal Quantity { get; set; }
        }
    }
}
