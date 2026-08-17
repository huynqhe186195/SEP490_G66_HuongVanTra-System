namespace UserService.Domain.Exceptions;

public class UserNotFoundException(Guid id)
    : Exception($"User with id '{id}' was not found.");

public class UserNotFoundByUsernameException(string username)
    : Exception($"User with username '{username}' was not found.");

public class InvalidCredentialsException()
    : Exception("Username or password is incorrect.");

public class UserDeactivatedException()
    : Exception("Tài khoản đã được cho ngừng hoạt động.");

public class UserInactiveException()
    : Exception("Tài khoản đã bị khoá.");

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

public class DuplicatePermissionException(string code)
    : Exception($"Mã quyền '{code}' đã tồn tại.");

public class UserValidationException(string message) : Exception(message);

public class PasswordResetException(string message) : Exception(message);

public class ShiftTemplateNotFoundException(Guid id)
    : Exception($"Shift template with id '{id}' was not found.");

public class ShiftSlotNotFoundException(Guid id)
    : Exception($"Shift slot with id '{id}' was not found.");

public class ShiftRegistrationNotFoundException(Guid id)
    : Exception($"Shift registration with id '{id}' was not found.");
