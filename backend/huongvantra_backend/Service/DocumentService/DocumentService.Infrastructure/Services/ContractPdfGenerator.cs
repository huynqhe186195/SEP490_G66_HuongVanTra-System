using DocumentService.Application.Interfaces;
using DocumentService.Application.Models;
using DocumentService.Infrastructure.Helpers;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace DocumentService.Infrastructure.Services;

public class ContractPdfGenerator : IContractDocumentGenerator
{
    static ContractPdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;
    }

    public Task<byte[]> GenerateDocxAsync(ContractDocumentData data, CancellationToken ct = default) =>
        throw new NotSupportedException("Use ContractDocxGenerator for DOCX.");

    public byte[] GeneratePdf(ContractDocumentData data)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontFamily(ContractPdfFonts.ResolveFamily()).FontSize(12));

                page.Content().Column(col =>
                {
                    col.Spacing(8);

                    var c = data.Contract;
                    var cust = data.Customer;
                    var seller = data.Seller;

                    // Quốc hiệu - Tiêu ngữ
                    col.Item().AlignCenter().Text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM").Bold().FontSize(13);
                    col.Item().AlignCenter().Text("Độc lập - Tự do - Hạnh phúc").Bold().FontSize(13);
                    col.Item().AlignCenter().Text("-------------------").FontSize(12);
                    col.Item().Height(8);

                    col.Item().AlignCenter().Text("HỢP ĐỒNG MUA BÁN HÀNG HÓA").Bold().FontSize(14);
                    col.Item().AlignCenter().Text($"Số: {c.ContractCode}/HĐMB").Bold().FontSize(13);
                    col.Item().Height(8);

                    // Căn cứ
                    col.Item().Text("Căn cứ:").FontSize(12);
                    col.Item().PaddingLeft(20).Text("- Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 và các văn bản pháp luật liên quan;");
                    col.Item().PaddingLeft(20).Text("- Luật Thương mại số 36/2005/QH11 ngày 14/06/2005 và các văn bản pháp luật liên quan;");
                    col.Item().PaddingLeft(20).Text("- Nhu cầu và khả năng của các bên;");
                    col.Item().Height(4);

                    var location = !string.IsNullOrWhiteSpace(c.SignedAtLocation) ? c.SignedAtLocation : "……………………";
                    var signDate = c.EffectiveDate;
                    var dateStr = signDate.HasValue
                        ? $"ngày {signDate.Value.Day:D2} tháng {signDate.Value.Month:D2} năm {signDate.Value.Year}"
                        : "ngày …… tháng …… năm ……";
                    col.Item().Text($"Hôm nay, {dateStr}, tại {location}");
                    col.Item().Text("Chúng tôi gồm có:");
                    col.Item().Height(4);

                    // Bên A
                    col.Item().Text("BÊN BÁN (Bên A)").Bold().Underline();
                    col.Item().Text($"Tên doanh nghiệp: {seller.CompanyName}");
                    col.Item().Text($"Mã số doanh nghiệp: {seller.TaxCode}");
                    col.Item().Text($"Địa chỉ trụ sở chính: {seller.RegisteredAddress}");
                    col.Item().Text($"Điện thoại: {seller.Phone}");
                    col.Item().Text($"Tài khoản số: {seller.BankAccountNumber}");
                    col.Item().Text($"Mở tại ngân hàng: {seller.BankName}");
                    col.Item().Text($"Đại diện theo pháp luật: {seller.LegalRepresentativeName}    Chức vụ: {seller.LegalRepresentativePosition}");
                    col.Item().Text($"CMND/Thẻ CCCD số: {seller.LegalRepresentativeIdNumber}    Nơi cấp: {seller.LegalRepresentativeIdIssuePlace}    Ngày cấp: {seller.LegalRepresentativeIdIssueDate}");
                    col.Item().Height(4);

                    // Bên B
                    col.Item().Text("BÊN MUA (Bên B)").Bold().Underline();
                    col.Item().Text($"Tên doanh nghiệp: {cust.FullName}");
                    col.Item().Text($"Mã số doanh nghiệp: {cust.TaxCode ?? "……………………"}");
                    col.Item().Text($"Địa chỉ trụ sở chính: {cust.RegisteredAddress ?? "……………………"}");
                    col.Item().Text($"Điện thoại: {cust.PhoneNumber ?? "……………………"}");
                    col.Item().Text($"Tài khoản số: {cust.BankAccountNumber ?? "……………………"}");
                    col.Item().Text($"Mở tại ngân hàng: {cust.BankName ?? "……………………"}");
                    col.Item().Text($"Đại diện theo pháp luật: {cust.LegalRepresentativeName ?? "……………………"}    Chức vụ: {cust.LegalRepresentativePosition ?? "……………………"}");
                    col.Item().Text($"CMND/Thẻ CCCD số: {cust.LegalRepresentativeIdNumber ?? "……………………"}    Nơi cấp: {cust.LegalRepresentativeIdIssuePlace ?? "……………………"}    Ngày cấp: {cust.LegalRepresentativeIdIssueDate ?? "……………………"}");
                    col.Item().Height(4);

                    col.Item().Text("Trên cơ sở thỏa thuận, hai bên thống nhất ký kết hợp đồng mua bán hàng hóa với các điều khoản như sau:").Justify();
                    col.Item().Height(4);

                    // Điều 1
                    col.Item().Text("Điều 1: TÊN HÀNG - SỐ LƯỢNG - CHẤT LƯỢNG - GIÁ TRỊ HỢP ĐỒNG").Bold().FontSize(13);
                    var lines = c.LineItems.OrderBy(l => l.LineNumber).ToList();
                    col.Item().Table(tbl =>
                    {
                        tbl.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(30);
                            cols.RelativeColumn(4);
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(3);
                            cols.RelativeColumn(3);
                            cols.RelativeColumn(2);
                        });

                        static IContainer CellStyle(IContainer c) =>
                            c.Border(1).BorderColor(Colors.Grey.Medium).Padding(4);

                        tbl.Header(h =>
                        {
                            h.Cell().Element(CellStyle).AlignCenter().Text("STT").Bold();
                            h.Cell().Element(CellStyle).Text("Tên hàng hóa").Bold();
                            h.Cell().Element(CellStyle).AlignCenter().Text("Đơn vị").Bold();
                            h.Cell().Element(CellStyle).AlignCenter().Text("Số lượng").Bold();
                            h.Cell().Element(CellStyle).AlignRight().Text("Đơn giá").Bold();
                            h.Cell().Element(CellStyle).AlignRight().Text("Thành tiền").Bold();
                            h.Cell().Element(CellStyle).Text("Ghi chú").Bold();
                        });

                        int i = 1;
                        foreach (var line in lines)
                        {
                            tbl.Cell().Element(CellStyle).AlignCenter().Text(i++.ToString());
                            tbl.Cell().Element(CellStyle).Text(line.ProductName);
                            tbl.Cell().Element(CellStyle).AlignCenter().Text(line.Unit ?? "");
                            tbl.Cell().Element(CellStyle).AlignRight().Text(line.Quantity.ToString("N0"));
                            tbl.Cell().Element(CellStyle).AlignRight().Text(line.UnitPrice.ToString("N0"));
                            tbl.Cell().Element(CellStyle).AlignRight().Text(line.LineAmount.ToString("N0"));
                            tbl.Cell().Element(CellStyle).Text(line.Note ?? "");
                        }
                    });

                    var total = c.LineItems.Sum(l => l.LineAmount);
                    col.Item().Text($"Tổng cộng: {total:N0} đồng").Bold();
                    col.Item().Text($"(Số tiền bằng chữ: {VietnameseNumberWords.Convert(total)})").Italic();
                    col.Item().Height(8);

                    // Điều 2
                    col.Item().Text("Điều 2: THANH TOÁN").Bold().FontSize(13);
                    var payDay = c.EffectiveDate.HasValue
                        ? $"ngày {c.EffectiveDate.Value.Day:D2} tháng {c.EffectiveDate.Value.Month:D2} năm {c.EffectiveDate.Value.Year}"
                        : "ngày …… tháng …… năm ……";
                    col.Item().PaddingLeft(12).Text($"1. Bên B phải thanh toán cho Bên A số tiền ghi tại Điều 1 của Hợp đồng này vào {payDay}.").Justify();
                    var payMethod = !string.IsNullOrWhiteSpace(c.PaymentMethod) ? c.PaymentMethod : "……………………";
                    col.Item().PaddingLeft(12).Text($"2. Bên B thanh toán cho Bên A theo hình thức {payMethod}.").Justify();
                    col.Item().Height(8);

                    // Điều 3
                    col.Item().Text("Điều 3: THỜI GIAN, ĐỊA ĐIỂM VÀ PHƯƠNG THỨC GIAO HÀNG").Bold().FontSize(13);
                    var deliveryTerms = !string.IsNullOrWhiteSpace(c.DeliveryTerms) ? c.DeliveryTerms : "……………………";
                    var shippingResp = !string.IsNullOrWhiteSpace(c.ShippingResponsibility) ? c.ShippingResponsibility : "……………………";
                    col.Item().PaddingLeft(12).Text($"1. Bên A giao cho bên B theo lịch sau: {deliveryTerms}").Justify();
                    col.Item().PaddingLeft(12).Text($"2. Phương tiện vận chuyển và chi phí vận chuyển do bên {shippingResp} chịu. Chi phí bốc xếp: ……………………………………………").Justify();
                    col.Item().PaddingLeft(12).Text("3. Quy định lịch giao nhận hàng hóa mà bên mua không đến nhận hàng thì phải chịu chi phí lưu kho bãi là …………… đồng/ngày. Nếu phương tiện vận chuyển bên mua đến mà bên bán không có hàng giao thì bên bán phải chịu chi phí thực tế cho việc điều động phương tiện.").Justify();
                    col.Item().PaddingLeft(12).Text("4. Khi nhận hàng, bên mua có trách nhiệm kiểm nhận phẩm chất, quy cách hàng hóa tại chỗ. Nếu phát hiện hàng thiếu hoặc không đúng tiêu chuẩn chất lượng v.v… thì lập biên bản tại chỗ, yêu cầu bên bán xác nhận. Hàng đã ra khỏi kho bên bán không chịu trách nhiệm (trừ loại hàng có quy định thời hạn bảo hành).").Justify();
                    col.Item().PaddingLeft(12).Text("5. Trường hợp giao nhận hàng theo nguyên đai, nguyên kiện, nếu bên mua sau khi chở về nhập kho mới hiện có vi phạm thì phải lập biên bản gọi cơ quan kiểm tra trung gian đến xác nhận và phải gửi đến bên bán trong hạn 10 ngày tính từ khi lập biên bản. Sau 15 ngày nếu bên bán đã nhận được biên bản mà không có ý kiến gì thì coi như đã chịu trách nhiệm bồi thường lô hàng đó.").Justify();
                    col.Item().Height(20);

                    // Ký tên
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(sig =>
                        {
                            sig.Item().AlignCenter().Text("ĐẠI DIỆN BÊN A").Bold();
                            sig.Item().AlignCenter().Text("(Ký, ghi rõ họ tên)").Italic();
                            sig.Item().Height(50);
                            sig.Item().AlignCenter().Text(seller.CompanyName).Bold();
                        });
                        row.RelativeItem().Column(sig =>
                        {
                            sig.Item().AlignCenter().Text("ĐẠI DIỆN BÊN B").Bold();
                            sig.Item().AlignCenter().Text("(Ký, ghi rõ họ tên)").Italic();
                            sig.Item().Height(50);
                            sig.Item().AlignCenter().Text(cust.FullName).Bold();
                        });
                    });
                });
            });
        });

        return doc.GeneratePdf();
    }
}
