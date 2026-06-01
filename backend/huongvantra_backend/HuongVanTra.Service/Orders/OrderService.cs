using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Sales;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Orders {
    public class OrderService : IOrderService {
        private readonly AppDbContext _dbContext;

        public OrderService(AppDbContext dbContext) {
            _dbContext = dbContext;
        }

        public async Task<PagedResult<OrderListItemDto>> GetOrdersAsync(OrderQuery query, CancellationToken cancellationToken = default) {
            var page = query.Page < 1 ? 1 : query.Page;
            var pageSize = query.PageSize < 1 ? 20 : Math.Min(query.PageSize, 100);

            var ordersQuery = _dbContext.Orders
                .AsNoTracking()
                .Include(o => o.Customer)
                .Include(o => o.PaymentTransactions)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(query.Search)) {
                var term = query.Search.Trim();
                ordersQuery = ordersQuery.Where(o =>
                    o.OrderCode.Contains(term) ||
                    (o.Customer != null && o.Customer.CustomerCode.Contains(term)) ||
                    (o.Customer != null && o.Customer.Phone != null && o.Customer.Phone.Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(query.OrderStatus)) {
                ordersQuery = ordersQuery.Where(o => o.OrderStatus == query.OrderStatus);
            }

            if (!string.IsNullOrWhiteSpace(query.PaymentStatus)) {
                ordersQuery = ordersQuery.Where(o => o.PaymentStatus == query.PaymentStatus);
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
                    CustomerName = o.Customer != null ? o.Customer.CustomerCode : "Khách lẻ",
                    CustomerPhone = o.Customer != null ? o.Customer.Phone : null,
                    PaymentMethod = o.PaymentTransactions
                        .OrderByDescending(p => p.TransactionDate)
                        .Select(p => p.PaymentMethod)
                        .FirstOrDefault(),
                    OrderStatus = o.OrderStatus,
                    PaymentStatus = o.PaymentStatus,
                    TotalAmount = o.TotalAmount,
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

        public async Task<OrderDetailDto?> GetOrderAsync(string idOrCode, CancellationToken cancellationToken = default) {
            var order = await ResolveOrderAsync(idOrCode, cancellationToken);
            return order is null ? null : MapToDetail(order);
        }

        public async Task<OrderDetailDto?> UpdateOrderStatusAsync(int id, UpdateOrderStatusRequest request, CancellationToken cancellationToken = default) {
            if (!OrderStatuses.IsValid(request.OrderStatus)) {
                throw new ArgumentException("Invalid order status.");
            }

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null) {
                return null;
            }

            order.OrderStatus = request.OrderStatus.ToUpperInvariant();

            if (!string.IsNullOrWhiteSpace(request.PaymentStatus)) {
                order.PaymentStatus = request.PaymentStatus.Trim().ToUpperInvariant();
            }

            if (!string.IsNullOrWhiteSpace(request.StockStatus)) {
                order.StockStatus = request.StockStatus.Trim().ToUpperInvariant();
            }

            order.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);

            return MapToDetail(order);
        }

        public async Task<OrderDetailDto?> ApplyCouponAsync(int id, ApplyCouponRequest request, CancellationToken cancellationToken = default) {
            if (string.IsNullOrWhiteSpace(request.PromoCode)) {
                throw new ArgumentException("Promo code is required.");
            }

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null) {
                return null;
            }

            var promoCode = request.PromoCode.Trim().ToUpperInvariant();
            var promotion = await _dbContext.OrderPromotions
                .FirstOrDefaultAsync(p => p.PromoCode.ToUpper() == promoCode, cancellationToken);

            if (promotion is null) {
                throw new ArgumentException("Coupon not found.");
            }

            order.PromotionId = promotion.Id;
            order.Promotion = promotion;
            RecalculateTotals(order);
            order.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapToDetail(order);
        }

        public async Task<OrderDetailDto?> AddGiftItemAsync(int id, AddGiftItemRequest request, CancellationToken cancellationToken = default) {
            if (request.ProductId <= 0 || request.Quantity <= 0) {
                throw new ArgumentException("Invalid gift item.");
            }

            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null) {
                return null;
            }

            var productExists = await _dbContext.Products.AnyAsync(p => p.Id == request.ProductId, cancellationToken);
            if (!productExists) {
                throw new ArgumentException("Product not found.");
            }

            order.OrderItems.Add(new OrderItem {
                ProductId = request.ProductId,
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

        public async Task<OrderDetailDto?> UpdateAdjustmentsAsync(int id, UpdateOrderAdjustmentsRequest request, CancellationToken cancellationToken = default) {
            var order = await LoadOrderGraphAsync(id, cancellationToken, tracking: true);
            if (order is null) {
                return null;
            }

            if (request.ManualDiscount.HasValue) {
                if (request.ManualDiscount.Value < 0) {
                    throw new ArgumentException("Manual discount cannot be negative.");
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

            order.CouponDiscount = 0;
            if (order.Promotion is not null) {
                order.CouponDiscount = order.Promotion.DiscountType.Equals("FIXED", StringComparison.OrdinalIgnoreCase)
                    ? order.Promotion.DiscountValue
                    : Math.Round(order.SubTotal * order.Promotion.DiscountValue / 100m, 2);
            }

            var total = order.SubTotal - order.CouponDiscount - order.ManualDiscount - order.DeductAmount;
            order.TotalAmount = total < 0 ? 0 : total;
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
                },
                Items = order.OrderItems.Select(i => new OrderItemDto {
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductSku = i.Product.Sku,
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
    }
}
