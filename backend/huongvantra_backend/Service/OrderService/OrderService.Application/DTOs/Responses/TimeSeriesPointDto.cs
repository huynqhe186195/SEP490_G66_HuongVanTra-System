namespace OrderService.Application.DTOs.Responses;

public class TimeSeriesPointDto
{
    public string Label { get; set; } = string.Empty;
    public decimal Value { get; set; }
}
