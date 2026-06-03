namespace HuongVanTra.Service.Sales.Models {
    public class SepaySetupDiagnostics {
        public string PaymentMode { get; set; } = "vietqr_main";
        public bool RequireSepayVa { get; set; }
        public bool ApiTokenConfigured { get; set; }
        public bool BankAccountUuidConfigured { get; set; }
        public bool StaticVaConfigured { get; set; }
        public bool CanCreateTransferQr { get; set; }
        public string? SetupMessage { get; set; }
        public List<SepayBankAccountItem> BankAccounts { get; set; } = new();
    }

    public class SepayBankAccountItem {
        public string Id { get; set; } = "";
        public string? BankName { get; set; }
        public string? AccountNumber { get; set; }
        public string? AccountHolderName { get; set; }
        public string? Status { get; set; }
    }
}
