namespace CustomerService.Domain.Entities;

public class ProcessedIntegrationEvent
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public Guid CorrelationId { get; set; }
    public DateTime ProcessedAt { get; set; }
}
