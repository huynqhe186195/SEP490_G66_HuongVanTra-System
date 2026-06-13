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
        : base("One or more validation errors occurred.")
    { Errors = errors.ToArray(); }

    public OrderValidationException(string error)
        : base("One or more validation errors occurred.")
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

public class OrderForbiddenException : Exception
{
    public OrderForbiddenException(string message = "Bạn không có quyền truy cập đơn hàng này.")
        : base(message) { }
}
