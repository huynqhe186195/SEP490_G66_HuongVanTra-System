namespace DocumentService.Domain.Exceptions;

public class ContractNotFoundException(Guid id)
    : Exception($"Không tìm thấy hợp đồng với Id = {id}.");

public class ContractValidationException(string message)
    : Exception(message);

public class ContractForbiddenException(string message)
    : Exception(message);
