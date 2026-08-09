using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentService.Application.Interfaces;
using DocumentService.Application.Models;
using DocumentService.Infrastructure.Helpers;

namespace DocumentService.Infrastructure.Services;

public class ContractDocxGenerator : IContractDocumentGenerator
{
    public Task<byte[]> GenerateDocxAsync(ContractDocumentData data, CancellationToken ct = default)
    {
        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document))
        {
            var mainPart = doc.AddMainDocumentPart();
            mainPart.Document = new Document(BuildBody(data));
            mainPart.Document.Save();
        }
        return Task.FromResult(ms.ToArray());
    }

    public byte[] GeneratePdf(ContractDocumentData data) =>
        throw new NotSupportedException("Use ContractPdfGenerator for PDF.");

    // ── Body ────────────────────────────────────────────────────────────────

    private static Body BuildBody(ContractDocumentData d)
    {
        var body = new Body();
        body.Append(PageSettings());

        var c = d.Contract;
        var cust = d.Customer;
        var seller = d.Seller;

        // Quốc hiệu - Tiêu ngữ
        body.Append(CenterBold("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", 26));
        body.Append(CenterBold("Độc lập - Tự do - Hạnh phúc", 26));
        body.Append(CenterText("-------------------", 24));
        body.Append(SpacePara());

        // Tiêu đề hợp đồng
        body.Append(CenterBold("HỢP ĐỒNG MUA BÁN HÀNG HÓA", 28));
        body.Append(CenterBold($"Số: {c.ContractCode}/HĐMB", 26));
        body.Append(SpacePara());

        // Căn cứ
        body.Append(Indent("Căn cứ:"));
        body.Append(BulletPara("Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 và các văn bản pháp luật liên quan;"));
        body.Append(BulletPara("Luật Thương mại số 36/2005/QH11 ngày 14/06/2005 và các văn bản pháp luật liên quan;"));
        body.Append(BulletPara("Nhu cầu và khả năng của các bên;"));
        body.Append(SpacePara());

        // Ngày ký
        var signDate = c.EffectiveDate;
        var location = !string.IsNullOrWhiteSpace(c.SignedAtLocation) ? c.SignedAtLocation : "……………………";
        var dateStr = signDate.HasValue
            ? $"ngày {signDate.Value.Day:D2} tháng {signDate.Value.Month:D2} năm {signDate.Value.Year}"
            : "ngày …… tháng …… năm ……";
        body.Append(Justified($"Hôm nay, {dateStr}, tại {location}"));
        body.Append(Justified("Chúng tôi gồm có:"));
        body.Append(SpacePara());

        // Bên A
        body.Append(BoldUnderline("BÊN BÁN (Bên A)"));
        body.Append(InfoLine("Tên doanh nghiệp:", seller.CompanyName));
        body.Append(InfoLine("Mã số doanh nghiệp:", seller.TaxCode));
        body.Append(InfoLine("Địa chỉ trụ sở chính:", seller.RegisteredAddress));
        body.Append(InfoLine("Điện thoại:", seller.Phone));
        body.Append(InfoLine("Tài khoản số:", seller.BankAccountNumber));
        body.Append(InfoLine("Mở tại ngân hàng:", seller.BankName));
        body.Append(TwoColLine("Đại diện theo pháp luật:", seller.LegalRepresentativeName,
            "Chức vụ:", seller.LegalRepresentativePosition));
        body.Append(ThreeColLine("CMND/Thẻ CCCD số:", seller.LegalRepresentativeIdNumber,
            "Nơi cấp:", seller.LegalRepresentativeIdIssuePlace,
            "Ngày cấp:", seller.LegalRepresentativeIdIssueDate));
        body.Append(SpacePara());

        // Bên B
        body.Append(BoldUnderline("BÊN MUA (Bên B)"));
        body.Append(InfoLine("Tên doanh nghiệp:", cust.FullName));
        body.Append(InfoLine("Mã số doanh nghiệp:", cust.TaxCode ?? "……………………"));
        body.Append(InfoLine("Địa chỉ trụ sở chính:", cust.RegisteredAddress ?? "……………………"));
        body.Append(InfoLine("Điện thoại:", cust.PhoneNumber ?? "……………………"));
        body.Append(InfoLine("Tài khoản số:", cust.BankAccountNumber ?? "……………………"));
        body.Append(InfoLine("Mở tại ngân hàng:", cust.BankName ?? "……………………"));
        body.Append(TwoColLine("Đại diện theo pháp luật:", cust.LegalRepresentativeName ?? "……………………",
            "Chức vụ:", cust.LegalRepresentativePosition ?? "……………………"));
        body.Append(ThreeColLine("CMND/Thẻ CCCD số:", cust.LegalRepresentativeIdNumber ?? "……………………",
            "Nơi cấp:", cust.LegalRepresentativeIdIssuePlace ?? "……………………",
            "Ngày cấp:", cust.LegalRepresentativeIdIssueDate ?? "……………………"));
        body.Append(SpacePara());

        body.Append(Justified("Trên cơ sở thỏa thuận, hai bên thống nhất ký kết hợp đồng mua bán hàng hóa với các điều khoản như sau:"));
        body.Append(SpacePara());

        // Điều 1
        body.Append(ArticleHeading("Điều 1: TÊN HÀNG - SỐ LƯỢNG - CHẤT LƯỢNG - GIÁ TRỊ HỢP ĐỒNG"));
        body.Append(BuildLineItemsTable(c.LineItems.OrderBy(l => l.LineNumber).ToList()));

        var total = c.LineItems.Sum(l => l.LineAmount);
        body.Append(Justified($"Tổng cộng: {total:N0} đồng"));
        body.Append(Justified($"(Số tiền bằng chữ: {VietnameseNumberWords.Convert(total)})"));
        body.Append(SpacePara());

        // Điều 2
        body.Append(ArticleHeading("Điều 2: THANH TOÁN"));
        var payDay = c.EffectiveDate.HasValue
            ? $"ngày {c.EffectiveDate.Value.Day:D2} tháng {c.EffectiveDate.Value.Month:D2} năm {c.EffectiveDate.Value.Year}"
            : "ngày …… tháng …… năm ……";
        body.Append(NumberedItem("1.", $"Bên B phải thanh toán cho Bên A số tiền ghi tại Điều 1 của Hợp đồng này vào {payDay}."));
        var payMethod = !string.IsNullOrWhiteSpace(c.PaymentMethod) ? c.PaymentMethod : "……………………";
        body.Append(NumberedItem("2.", $"Bên B thanh toán cho Bên A theo hình thức {payMethod}."));
        body.Append(SpacePara());

        // Điều 3
        body.Append(ArticleHeading("Điều 3: THỜI GIAN, ĐỊA ĐIỂM VÀ PHƯƠNG THỨC GIAO HÀNG"));
        var delivery = !string.IsNullOrWhiteSpace(c.DeliveryTerms) ? c.DeliveryTerms : "……………………";
        body.Append(NumberedItem("1.", $"Bên A giao cho bên B theo lịch sau: {delivery}"));
        var shipping = !string.IsNullOrWhiteSpace(c.ShippingResponsibility) ? c.ShippingResponsibility : "……………………";
        body.Append(NumberedItem("2.", $"Phương tiện vận chuyển và chi phí vận chuyển do bên {shipping} chịu. Chi phí bốc xếp: ……………………………………………"));
        body.Append(NumberedItem("3.", "Quy định lịch giao nhận hàng hóa mà bên mua không đến nhận hàng thì phải chịu chi phí lưu kho bãi là …………… đồng/ngày. Nếu phương tiện vận chuyển bên mua đến mà bên bán không có hàng giao thì bên bán phải chịu chi phí thực tế cho việc điều động phương tiện."));
        body.Append(NumberedItem("4.", "Khi nhận hàng, bên mua có trách nhiệm kiểm nhận phẩm chất, quy cách hàng hóa tại chỗ. Nếu phát hiện hàng thiếu hoặc không đúng tiêu chuẩn chất lượng v.v… thì lập biên bản tại chỗ, yêu cầu bên bán xác nhận. Hàng đã ra khỏi kho bên bán không chịu trách nhiệm (trừ loại hàng có quy định thời hạn bảo hành)."));
        body.Append(NumberedItem("5.", "Trường hợp giao nhận hàng theo nguyên đai, nguyên kiện, nếu bên mua sau khi chở về nhập kho mới hiện có vi phạm thì phải lập biên bản gọi cơ quan kiểm tra trung gian đến xác nhận và phải gửi đến bên bán trong hạn 10 ngày tính từ khi lập biên bản. Sau 15 ngày nếu bên bán đã nhận được biên bản mà không có ý kiến gì thì coi như đã chịu trách nhiệm bồi thường lô hàng đó."));
        body.Append(SpacePara());

        // Ký tên
        body.Append(SignatureTable(seller.CompanyName, cust.FullName));

        body.Append(new SectionProperties(new PageSize { Width = 12240, Height = 15840 },
            new PageMargin { Top = 1134, Bottom = 1134, Left = 1701, Right = 1134 }));

        return body;
    }

    // ── Table line items ────────────────────────────────────────────────────

    private static Table BuildLineItemsTable(IList<Domain.Entities.ContractLineItem> items)
    {
        var table = new Table();
        table.AppendChild(new TableProperties(
            new TableWidth { Width = "9360", Type = TableWidthUnitValues.Dxa },
            new TableBorders(
                Border(new TopBorder()), Border(new BottomBorder()),
                Border(new LeftBorder()), Border(new RightBorder()),
                Border(new InsideHorizontalBorder()), Border(new InsideVerticalBorder()))));

        // Header row
        table.AppendChild(new TableRow(
            TH("STT", 600), TH("Tên hàng hóa", 2400), TH("Đơn vị", 800),
            TH("Số lượng", 900), TH("Đơn giá", 1300), TH("Thành tiền", 1500), TH("Ghi chú", 1860)));

        int i = 1;
        foreach (var line in items)
        {
            table.AppendChild(new TableRow(
                TD(i++.ToString(), 600),
                TD(line.ProductName, 2400),
                TD(line.Unit ?? "", 800),
                TD(line.Quantity.ToString("N0"), 900),
                TD(line.UnitPrice.ToString("N0"), 1300),
                TD(line.LineAmount.ToString("N0"), 1500),
                TD(line.Note ?? "", 1860)));
        }

        // Total row
        var totalCell = new TableCell(
            new TableCellProperties(
                new TableCellWidth { Width = "9060", Type = TableWidthUnitValues.Dxa },
                new GridSpan { Val = 6 }),
            new Paragraph(new Run(RunProps(true),
                new Text($"Tổng cộng: {items.Sum(l => l.LineAmount):N0} đồng") { Space = SpaceProcessingModeValues.Preserve })));
        table.AppendChild(new TableRow(totalCell, TD("", 1860)));
        table.Append(SpacePara());
        return table;
    }

    // ── Signature table ─────────────────────────────────────────────────────

    private static Table SignatureTable(string sellerName, string buyerName)
    {
        var table = new Table();
        table.AppendChild(new TableProperties(
            new TableWidth { Width = "9360", Type = TableWidthUnitValues.Dxa },
            new TableBorders(new TopBorder { Val = BorderValues.None }, new BottomBorder { Val = BorderValues.None },
                new LeftBorder { Val = BorderValues.None }, new RightBorder { Val = BorderValues.None },
                new InsideHorizontalBorder { Val = BorderValues.None }, new InsideVerticalBorder { Val = BorderValues.None })));

        table.AppendChild(new TableRow(
            SignCell("ĐẠI DIỆN BÊN A", sellerName),
            SignCell("ĐẠI DIỆN BÊN B", buyerName)));
        return table;
    }

    private static TableCell SignCell(string label, string name) =>
        new(new TableCellProperties(new TableCellWidth { Width = "4680", Type = TableWidthUnitValues.Dxa }),
            new Paragraph(Run(label, true, 24, JustificationValues.Center)),
            new Paragraph(Run("(Ký, ghi rõ họ tên)", false, 22, JustificationValues.Center)),
            new Paragraph(new ParagraphProperties(new SpacingBetweenLines { After = "800" }),
                new Run(RunProps(false))),
            new Paragraph(Run(name, true, 24, JustificationValues.Center)));

    // ── Paragraph helpers ───────────────────────────────────────────────────

    private static Paragraph CenterBold(string text, int size = 24) =>
        new(new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
            new Run(RunProps(true, size), new Text(text)));

    private static Paragraph CenterText(string text, int size = 24) =>
        new(new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
            new Run(RunProps(false, size), new Text(text)));

    private static Paragraph Justified(string text) =>
        new(new ParagraphProperties(new Justification { Val = JustificationValues.Both }),
            new Run(RunProps(false), new Text(text) { Space = SpaceProcessingModeValues.Preserve }));

    private static Paragraph Indent(string text) =>
        new(new ParagraphProperties(new Indentation { Left = "360" }),
            new Run(RunProps(false), new Text(text)));

    private static Paragraph BulletPara(string text) =>
        new(new ParagraphProperties(new Indentation { Left = "720", Hanging = "360" }),
            new Run(RunProps(false), new Text("- " + text) { Space = SpaceProcessingModeValues.Preserve }));

    private static Paragraph BoldUnderline(string text) =>
        new(new Run(new RunProperties(new Bold(), new Underline { Val = UnderlineValues.Single },
            new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" },
            new FontSize { Val = "26" }),
            new Text(text)));

    private static Paragraph ArticleHeading(string text) =>
        new(new ParagraphProperties(new SpacingBetweenLines { Before = "240", After = "120" }),
            new Run(new RunProperties(new Bold(),
                new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" },
                new FontSize { Val = "26" }),
                new Text(text)));

    private static Paragraph NumberedItem(string num, string text) =>
        new(new ParagraphProperties(new Justification { Val = JustificationValues.Both },
                new Indentation { Left = "360" }),
            new Run(RunProps(false), new Text(num + " " + text) { Space = SpaceProcessingModeValues.Preserve }));

    private static Paragraph InfoLine(string label, string value)
    {
        var p = new Paragraph(new ParagraphProperties(new Justification { Val = JustificationValues.Both }));
        p.AppendChild(new Run(RunProps(false),
            new Text(label + " ") { Space = SpaceProcessingModeValues.Preserve }));
        p.AppendChild(new Run(RunProps(false), new Text(value)));
        return p;
    }

    private static Paragraph TwoColLine(string l1, string v1, string l2, string v2) =>
        Justified($"{l1} {v1}    {l2} {v2}");

    private static Paragraph ThreeColLine(string l1, string v1, string l2, string v2, string l3, string v3) =>
        Justified($"{l1} {v1}    {l2} {v2}    {l3} {v3}");

    private static Paragraph SpacePara() =>
        new(new ParagraphProperties(new SpacingBetweenLines { After = "160" }),
            new Run(RunProps(false)));

    private static Paragraph Run(string text, bool bold, int size, JustificationValues align) =>
        new(new ParagraphProperties(new Justification { Val = align }),
            new Run(RunProps(bold, size), new Text(text)));

    // ── RunProperties ────────────────────────────────────────────────────────

    private static RunProperties RunProps(bool bold, int size = 26)
    {
        var rp = new RunProperties(
            new RunFonts { Ascii = "Times New Roman", HighAnsi = "Times New Roman" },
            new FontSize { Val = size.ToString() });
        if (bold) rp.AppendChild(new Bold());
        return rp;
    }

    // ── Table cell helpers ───────────────────────────────────────────────────

    private static TableCell TH(string text, int width) =>
        new(new TableCellProperties(
                new TableCellWidth { Width = width.ToString(), Type = TableWidthUnitValues.Dxa },
                new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = "CCCCCC" }),
            new Paragraph(new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
                new Run(RunProps(true, 22), new Text(text))));

    private static TableCell TD(string text, int width) =>
        new(new TableCellProperties(
                new TableCellWidth { Width = width.ToString(), Type = TableWidthUnitValues.Dxa }),
            new Paragraph(
                new Run(RunProps(false, 22), new Text(text) { Space = SpaceProcessingModeValues.Preserve })));

    private static T Border<T>(T b) where T : BorderType
    {
        b.Val = BorderValues.Single;
        b.Size = 4;
        b.Space = 0;
        b.Color = "000000";
        return b;
    }

    // ── Page settings ────────────────────────────────────────────────────────

    private static SectionProperties PageSettings() =>
        new(new PageSize { Width = 12240, Height = 15840 },
            new PageMargin { Top = 1134, Bottom = 1134, Left = 1701, Right = 1134 });
}
