namespace HuongVanTra.Service.Sales.Models {
    public class ConfirmPaymentCommand {
        public int OrderId { get; set; }
        public int EmployeeId { get; set; }
        public string? PaymentReference { get; set; }
        public string? Note { get; set; }
    }
}
