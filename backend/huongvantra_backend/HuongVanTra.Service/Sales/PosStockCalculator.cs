using HuongVanTra.Core.Entities.Products;

namespace HuongVanTra.Service.Sales {
    public static class PosStockCalculator {
        /// <summary>
        /// Số lượng có thể bán tại kho: thành phẩm trực tiếp hoặc theo BOM (hạn chế bởi nguyên liệu).
        /// </summary>
        public static decimal CalculateSellableQuantity(
            int productId,
            IReadOnlyDictionary<int, decimal> balanceByProductId,
            IReadOnlyDictionary<int, BomHeader> bomByFinishedGoodId) {
            if (!bomByFinishedGoodId.TryGetValue(productId, out var bom) || bom.BomLines.Count == 0) {
                return balanceByProductId.TryGetValue(productId, out var direct)
                    ? Math.Max(0, direct)
                    : 0;
            }

            if (bom.QuantityOutput <= 0) {
                return 0;
            }

            decimal? minUnits = null;
            foreach (var line in bom.BomLines) {
                if (line.Quantity <= 0) {
                    return 0;
                }

                var materialAvailable = balanceByProductId.TryGetValue(line.MaterialId, out var materialQty)
                    ? materialQty
                    : 0;

                var materialPerUnit = line.Quantity / bom.QuantityOutput;
                if (materialPerUnit <= 0) {
                    return 0;
                }

                var possibleUnits = Math.Floor(materialAvailable / materialPerUnit);
                minUnits = minUnits.HasValue
                    ? Math.Min(minUnits.Value, possibleUnits)
                    : possibleUnits;
            }

            return Math.Max(0, minUnits ?? 0);
        }
    }
}
