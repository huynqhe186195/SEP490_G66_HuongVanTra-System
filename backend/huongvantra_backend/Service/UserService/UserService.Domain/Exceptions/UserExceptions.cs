namespace UserService.Domain.Exceptions;

public class UserNotFoundException(Guid id)
    : Exception($"User with id '{id}' was not found.");

public class UserNotFoundByUsernameException(string username)
    : Exception($"User with username '{username}' was not found.");

public class InvalidCredentialsException()
    : Exception("Username or password is incorrect.");

public class UserInactiveException()
    : Exception("This account has been deactivated.");

public class DuplicateUsernameException(string username)
    : Exception($"Username '{username}' already exists.");

public class RoleNotFoundException(int id)
    : Exception($"Role with id '{id}' was not found.");

public class PermissionNotFoundException(int id)
    : Exception($"Permission with id '{id}' was not found.");

public class EmployeeNotFoundException(long id)
    : Exception($"Employee with id '{id}' was not found.");

public class InvalidRefreshTokenException()
    : Exception("Refresh token is invalid or expired.");

public class ForbiddenException(string message = "You do not have permission to perform this action.")
    : Exception(message);

public class RoleInUseException(int id)
    : Exception($"Role with id '{id}' is assigned to users and cannot be deleted.");

public class DuplicatePermissionException(string name)
    : Exception($"Permission '{name}' already exists.");
