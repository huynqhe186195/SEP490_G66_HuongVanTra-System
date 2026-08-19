using ClosedXML.Excel;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Export;

public static class OrderExportExcelBuilder
{
    private const string SheetName = "Danh sách đơn hàng";
    private const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private const string FontName = "Times New Roman";
    private const double FontSize = 12;
    private static readonly XLColor BrandColor = XLColor.FromHtml("#356647");
    private static readonly XLColor HeaderBg = XLColor.FromHtml("#f6f4ec");
    private static readonly XLColor ZebraBg = XLColor.FromHtml("#fbf9f1");
    private static readonly XLColor MutedColor = XLColor.FromHtml("#717971");

    private static readonly string[] Headers =
    [
        "Mã đơn",
        "Ngày tạo",
        "Trạng thái",
        "Khách hàng",
        "Kênh bán",
        "Loại đơn",
        "Người bán",
        "SL sản phẩm",
        "Tổng tiền",
        "Giảm giá",
        "Thành tiền",
        "Đồng bộ kho",
        "Ghi chú",
    ];

    public static OrderExcelFileResponse Build(IReadOnlyList<Order> orders, string filePrefix = "Don_Hang")
    {
        var vnNow = DateTime.UtcNow.AddHours(7);
        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet(SheetName);

        WriteTitleBlock(worksheet, "Danh sách đơn hàng",
            $"Export lúc {vnNow:dd/MM/yyyy HH:mm} · Tổng {orders.Count} đơn (tối đa 10.000 dòng theo bộ lọc hiện tại)",
            Headers.Length);

        const int headerRow = 4;
        WriteHeaderRow(worksheet, headerRow, Headers);

        var row = headerRow + 1;
        foreach (var order in orders)
        {
            var totalQty = order.OrderDetails?.Sum(d => d.Quantity) ?? 0;
            var createdLocal = order.CreatedAt.AddHours(7);
            worksheet.Cell(row, 1).Value = order.OrderCode;
            worksheet.Cell(row, 2).Value = createdLocal;
            worksheet.Cell(row, 2).Style.DateFormat.Format = "dd/MM/yyyy HH:mm";
            worksheet.Cell(row, 3).Value = FormatStatus(order.OrderStatus);
            worksheet.Cell(row, 4).Value = order.CustomerSnapshotName ?? "Khách lẻ";
            worksheet.Cell(row, 5).Value = FormatChannel(order.OrderChannel);
            worksheet.Cell(row, 6).Value = FormatOrderKind(order.OrderKind);
            worksheet.Cell(row, 7).Value = order.EmployeeSnapshotName ?? "—";
            worksheet.Cell(row, 8).Value = totalQty;
            worksheet.Cell(row, 9).Value = order.TotalAmount;
            worksheet.Cell(row, 10).Value = order.DiscountAmount;
            worksheet.Cell(row, 11).Value = order.FinalAmount;
            worksheet.Cell(row, 12).Value = FormatInventorySync(order.InventorySyncStatus);
            worksheet.Cell(row, 13).Value = order.Note ?? string.Empty;

            worksheet.Cell(row, 8).Style.NumberFormat.Format = "#,##0";
            worksheet.Cell(row, 9).Style.NumberFormat.Format = "#,##0";
            worksheet.Cell(row, 10).Style.NumberFormat.Format = "#,##0";
            worksheet.Cell(row, 11).Style.NumberFormat.Format = "#,##0";
            StyleDataRow(worksheet, row, Headers.Length, (row - headerRow) % 2 == 0);
            row++;
        }

        FinalizeListSheet(worksheet, headerRow, row - 1, Headers.Length);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var fileName = $"{filePrefix}_{vnNow:yyyyMMdd_HHmm}.xlsx";
        return new OrderExcelFileResponse(stream.ToArray(), fileName, ContentType);
    }

    private static string FormatStatus(OrderStatus status) => status switch
    {
        OrderStatus.Draft => "Nháp",
        OrderStatus.PendingPayment => "Chờ thanh toán",
        OrderStatus.Processing => "Đang xử lý",
        OrderStatus.Shipping => "Đang giao",
        OrderStatus.Completed => "Hoàn tất",
        OrderStatus.Cancelled => "Đã hủy",
        OrderStatus.WaitingMaterials => "Chờ nguyên liệu",
        OrderStatus.CancellationRequested => "Chờ duyệt hủy/hoàn tiền",
        OrderStatus.WaitingTransfer => "Chờ điều chuyển",
        OrderStatus.WaitingProduction => "Chờ sản xuất",
        OrderStatus.ReadyToDeliver => "Sẵn sàng giao",
        _ => status.ToString(),
    };

    private static string FormatChannel(OrderChannel channel) => channel switch
    {
        OrderChannel.POS => "Bán tại quầy",
        OrderChannel.COD => "COD (giao hàng thu tiền)",
        OrderChannel.B2B => "Doanh nghiệp (hợp đồng)",
        OrderChannel.Website => "Website",
        OrderChannel.Zalo => "Zalo",
        OrderChannel.Phone => "Điện thoại",
        _ => channel.ToString(),
    };

    private static string FormatOrderKind(OrderKind kind) => kind switch
    {
        OrderKind.Sale => "Bán hàng",
        OrderKind.Exchange => "Đổi hàng",
        _ => kind.ToString(),
    };

    private static string FormatInventorySync(InventorySyncStatus status) => status switch
    {
        InventorySyncStatus.Synced => "Đã đồng bộ kho",
        InventorySyncStatus.PendingDeduction => "Chờ trừ tồn quầy",
        InventorySyncStatus.PendingReconciliation => "Chờ đối soát nguyên liệu",
        InventorySyncStatus.Cancelled => "Không trừ tồn kho (đã hủy)",
        _ => status.ToString(),
    };

    private static readonly string[] ReturnSlipHeaders =
    [
        "Mã phiếu trả",
        "Đơn gốc",
        "Kênh",
        "Khách hàng",
        "Giá trị trả",
        "Hoàn tiền",
        "Giá trị đổi",
        "Mã đơn đổi",
        "Trạng thái",
        "Ngày tạo",
        "Ghi chú",
    ];

    public static OrderExcelFileResponse BuildReturnSlips(
        IReadOnlyList<(ReturnOrder Item, OrderChannel SourceChannel, string? ExchangeOrderCode)> slips,
        string filePrefix = "Phieu_Tra_Hang")
    {
        var vnNow = DateTime.UtcNow.AddHours(7);
        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("Phiếu trả hàng");

        WriteTitleBlock(worksheet, "Danh sách phiếu trả hàng",
            $"Export lúc {vnNow:dd/MM/yyyy HH:mm} · Tổng {slips.Count} phiếu (tối đa 10.000 dòng theo bộ lọc hiện tại)",
            ReturnSlipHeaders.Length);

        const int headerRow = 4;
        WriteHeaderRow(worksheet, headerRow, ReturnSlipHeaders);

        var row = headerRow + 1;
        foreach (var (item, sourceChannel, exchangeCode) in slips)
        {
            var createdLocal = item.CreatedAt.AddHours(7);
            worksheet.Cell(row, 1).Value = item.ReturnCode;
            worksheet.Cell(row, 2).Value = item.SourceOrderCode;
            worksheet.Cell(row, 3).Value = FormatChannel(sourceChannel);
            worksheet.Cell(row, 4).Value = item.CustomerSnapshotName ?? "Khách lẻ";
            worksheet.Cell(row, 5).Value = item.ReturnAmount;
            worksheet.Cell(row, 6).Value = item.RefundAmount;
            worksheet.Cell(row, 7).Value = item.ExchangeAmount;
            worksheet.Cell(row, 8).Value = exchangeCode ?? "—";
            worksheet.Cell(row, 9).Value = FormatReturnAcceptance(item.AcceptanceStatus);
            worksheet.Cell(row, 10).Value = createdLocal;
            worksheet.Cell(row, 10).Style.DateFormat.Format = "dd/MM/yyyy HH:mm";
            worksheet.Cell(row, 11).Value = item.Note ?? string.Empty;

            worksheet.Cell(row, 5).Style.NumberFormat.Format = "#,##0";
            worksheet.Cell(row, 6).Style.NumberFormat.Format = "#,##0";
            worksheet.Cell(row, 7).Style.NumberFormat.Format = "#,##0";
            StyleDataRow(worksheet, row, ReturnSlipHeaders.Length, (row - headerRow) % 2 == 0);
            row++;
        }

        FinalizeListSheet(worksheet, headerRow, row - 1, ReturnSlipHeaders.Length);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var fileName = $"{filePrefix}_{vnNow:yyyyMMdd_HHmm}.xlsx";
        return new OrderExcelFileResponse(stream.ToArray(), fileName, ContentType);
    }

    private static string FormatReturnAcceptance(ReturnAcceptanceStatus status) => status switch
    {
        ReturnAcceptanceStatus.Pending => "Chờ duyệt",
        ReturnAcceptanceStatus.Accepted => "Đã chấp nhận",
        ReturnAcceptanceStatus.Rejected => "Đã từ chối",
        _ => status.ToString(),
    };

    private static void WriteTitleBlock(IXLWorksheet worksheet, string title, string subtitle, int columnCount)
    {
        worksheet.Cell(1, 1).Value = title;
        worksheet.Range(1, 1, 1, columnCount).Merge();
        ApplyFont(worksheet.Cell(1, 1).Style.Font, bold: true, fontColor: XLColor.White);
        worksheet.Cell(1, 1).Style.Fill.BackgroundColor = BrandColor;
        worksheet.Cell(1, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        worksheet.Cell(1, 1).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        worksheet.Row(1).Height = 26;

        worksheet.Cell(2, 1).Value = subtitle;
        worksheet.Range(2, 1, 2, columnCount).Merge();
        ApplyFont(worksheet.Cell(2, 1).Style.Font, italic: true, fontColor: MutedColor);
        worksheet.Cell(2, 1).Style.Alignment.WrapText = true;
    }

    private static void WriteHeaderRow(IXLWorksheet worksheet, int headerRow, IReadOnlyList<string> headers)
    {
        for (var col = 0; col < headers.Count; col++)
        {
            var cell = worksheet.Cell(headerRow, col + 1);
            cell.Value = headers[col];
            ApplyFont(cell.Style.Font, bold: true);
            cell.Style.Fill.BackgroundColor = HeaderBg;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Medium;
            cell.Style.Border.BottomBorderColor = BrandColor;
        }
        worksheet.Row(headerRow).Height = 24;
    }

    private static void StyleDataRow(IXLWorksheet worksheet, int row, int columnCount, bool zebra)
    {
        for (var col = 1; col <= columnCount; col++)
        {
            var cell = worksheet.Cell(row, col);
            ApplyFont(cell.Style.Font);
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
            if (zebra)
                cell.Style.Fill.BackgroundColor = ZebraBg;
        }
    }

    private static void ApplyFont(IXLFont font, bool bold = false, bool italic = false, XLColor? fontColor = null)
    {
        font.FontName = FontName;
        font.FontSize = FontSize;
        font.Bold = bold;
        font.Italic = italic;
        if (fontColor is not null)
            font.FontColor = fontColor;
    }

    private static void FinalizeListSheet(IXLWorksheet worksheet, int headerRow, int lastDataRow, int columnCount)
    {
        if (lastDataRow >= headerRow + 1)
        {
            worksheet.Range(headerRow, 1, lastDataRow, columnCount).SetAutoFilter();
        }

        worksheet.Columns(1, columnCount).AdjustToContents(8, 48);
        worksheet.SheetView.FreezeRows(headerRow);
    }
}

public record OrderExcelFileResponse(byte[] Content, string FileName, string ContentType);
