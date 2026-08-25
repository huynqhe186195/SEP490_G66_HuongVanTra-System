using Moq;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.UseCases;
using OrderService.Domain.Exceptions;
using Xunit;

namespace OrderService.Application.Tests;

public sealed class TopSellingProductsReportTests
{
    [Fact]
    public async Task Valid_filter_and_top_count_are_forwarded_to_repository()
    {
        var repo = new Mock<IReportRepository>();
        repo.Setup(r => r.GetTopSellingProductsAsync(3, "quantity", 2, 5, 2026, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        var logic = new ReportLogic(repo.Object);

        var result = await logic.GetTopSellingProductsAsync(3, "quantity", 2, 5, 2026);

        Assert.Empty(result);
        repo.VerifyAll();
    }

    [Theory]
    [InlineData(0, "revenue", 1, 1)]
    [InlineData(101, "revenue", 1, 1)]
    [InlineData(5, "invalid", 1, 1)]
    [InlineData(5, "revenue", 5, 1)]
    [InlineData(5, "revenue", 1, 13)]
    public async Task Invalid_top_product_query_is_rejected(int topCount, string sortBy, int quarter, int month)
    {
        var logic = new ReportLogic(Mock.Of<IReportRepository>());

        await Assert.ThrowsAsync<OrderValidationException>(() =>
            logic.GetTopSellingProductsAsync(topCount, sortBy, quarter, month, 2026));
    }
}
