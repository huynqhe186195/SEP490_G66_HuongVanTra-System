namespace OrderService.Domain.Exceptions;

public class OrderNotFoundException : Exception
{
    public OrderNotFoundException(Guid id)
        : base($"Order with id '{id}' was not found.") { }
}

public class OrderNotFoundByCodeException : Exception
{
    public OrderNotFoundByCodeException(string code)
        : base($"Order with code '{code}' was not found.") { }
}

public class OrderValidationException : Exception
{
    public OrderValidationException(IEnumerable<string> errors)
        : base(string.Join("; ", errors))
    { Errors = errors.ToArray(); }

    public OrderValidationException(string error)
        : base(error)
    { Errors = [error]; }

    public IReadOnlyCollection<string> Errors { get; }
}

public class PromotionNotFoundException : Exception
{
    public PromotionNotFoundException(Guid id)
        : base($"Không tìm thấy mã giảm giá '{id}'.") { }
}

public class OrderCannotBeCancelledException : Exception
{
    public OrderCannotBeCancelledException(Guid id, string status)
        : base($"Order '{id}' cannot be cancelled because its status is '{status}'.") { }
}

public class OrderCannotBeModifiedException : Exception
{
    public OrderCannotBeModifiedException(Guid id, string status)
        : base($"Không thể sửa đơn hàng khi trạng thái là \"{GetStatusLabel(status)}\". Chỉ sửa được đơn chờ thanh toán, đang xử lý hoặc đang giao.") { }

    private static string GetStatusLabel(string status) => status switch
    {
        "Completed" => "Hoàn tất",
        "Cancelled" => "Đã hủy",
        "PendingPayment" => "Chờ thanh toán",
        "Processing" => "Đang xử lý",
        "Shipping" => "Đang giao",
        _ => status,
    };
}

public class ReturnOrderNotFoundException : Exception
{
    public ReturnOrderNotFoundException(Guid id)
        : base($"Return order '{id}' was not found.") { }
}

public class PaymentNotFoundException : Exception
{
    public PaymentNotFoundException(Guid id)
        : base($"Payment with id '{id}' was not found.") { }
}

public class DuplicateOrderCodeException : Exception
{
    public DuplicateOrderCodeException(string code)
        : base($"Order code '{code}' already exists.") { }
}

public class DuplicateOrderIdempotencyKeyException : Exception
{
    public DuplicateOrderIdempotencyKeyException(Exception innerException)
        : base("Order idempotency key already exists.", innerException) { }
}

public class OrderForbiddenException : Exception
{
    public OrderForbiddenException(string message = "Bạn không có quyền truy cập đơn hàng này.")
        : base(message) { }
}

/// <summary>
/// Service phụ thuộc (CustomerService/DocumentService) không phản hồi. Phải chặn đơn thay vì
/// bỏ qua ràng buộc hợp đồng/hạn mức một cách im lặng.
/// </summary>
public class OrderDependencyUnavailableException : Exception
{
    public OrderDependencyUnavailableException(string dependency, Exception? innerException = null)
        : base($"Không thể kết nối tới dịch vụ {dependency}. Vui lòng thử lại sau ít phút.", innerException)
    { Dependency = dependency; }

    public string Dependency { get; }
}
