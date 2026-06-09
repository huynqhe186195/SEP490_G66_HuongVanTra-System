namespace InventoryService.Domain.Exceptions;

public class InventoryValidationException(string message) : Exception(message);
