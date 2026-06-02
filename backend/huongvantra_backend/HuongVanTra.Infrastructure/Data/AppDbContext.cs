using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Entities.Products;
using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.Stores;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace HuongVanTra.Infrastructure.Data {
    public class AppDbContext : DbContext {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // module: Identity
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }

        // module: Store
        public DbSet<Store> Stores { get; set; }
        public DbSet<StoreSetting> StoreSettings { get; set; }

        // module: Customers
        public DbSet<MembershipTier> MembershipTiers { get; set; }
        public DbSet<Customer> Customers { get; set; }

        // module: Products
        public DbSet<ProductCategory> ProductCategories { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<BomHeader> BomHeaders { get; set; }
        public DbSet<BomLine> BomLines { get; set; }

        // module: Inventory
        public DbSet<Warehouse> Warehouses { get; set; }
        public DbSet<InventoryBalance> InventoryBalances { get; set; }
        public DbSet<StockVoucher> StockVouchers { get; set; }
        public DbSet<InventoryTransaction> InventoryTransactions { get; set; }

        // module: Sales
        public DbSet<OrderPromotion> OrderPromotions { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<PaymentTransaction> PaymentTransactions { get; set; }
        public DbSet<StockDeductQueue> StockDeductQueues { get; set; }
        public DbSet<OrderStockShortage> OrderStockShortages { get; set; }

        // module: HR
        public DbSet<HuongVanTra.Core.Entities.HR.Department> Departments { get; set; }
        public DbSet<HuongVanTra.Core.Entities.HR.SalaryRecord> SalaryRecords { get; set; }

        // module: System
        public DbSet<HuongVanTra.Core.Entities.System.AuditLog> AuditLogs { get; set; }

        // module: Production
        public DbSet<HuongVanTra.Core.Entities.Production.ProductionOrder> ProductionOrders { get; set; }

        // module: Finance
        public DbSet<HuongVanTra.Core.Entities.Finance.CashflowVoucher> CashflowVouchers { get; set; }

        // module: Documents
        public DbSet<HuongVanTra.Core.Entities.Documents.Document> Documents { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder) {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        }
    }
}