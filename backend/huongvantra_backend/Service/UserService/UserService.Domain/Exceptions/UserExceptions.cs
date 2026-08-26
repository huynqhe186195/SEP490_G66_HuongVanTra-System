namespace UserService.Domain.Exceptions;

public class UserNotFoundException(Guid id)
    : Exception($"Người dùng với ID '{id}' không tồn tại");

public class UserNotFoundByUsernameException(string username)
    : Exception($"User with username '{username}' was not found.");

public class UserDeactivatedByIdException(Guid id)
    : Exception($"Người dùng với ID '{id}' đã bị ngừng hoạt động");

public class UserAlreadyLockedByIdException(Guid id)
    : Exception($"Người dùng với ID '{id}' đã bị khoá");

public class InvalidCredentialsException()
    : Exception("Tên đăng nhập hoặc mật khẩu không chính xác.");

public class UserDeactivatedException()
    : Exception("Tài khoản đã được cho ngừng hoạt động.");

public class UserInactiveException()
    : Exception("Tài khoản đã bị khoá.");

public class DuplicateUsernameException(string username)
    : Exception($"Tên đăng nhập '{username}' đã tồn tại");

public class RoleNotFoundException(int id)
    : Exception($"Vai trò với ID '{id}' không tồn tại");

public class RoleAlreadyDeactivatedException(int id)
    : Exception($"Vai trò với ID '{id}' đã bị ngừng hoạt động");

public class PermissionNotFoundException(int id)
    : Exception($"Quyền với ID '{id}' không tồn tại");

public class PermissionAlreadyDeactivatedException(int id)
    : Exception($"Quyền với ID '{id}' đã bị ngừng hoạt động");

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

public class DuplicateRoleException(string roleName)
    : Exception($"Tên vai trò '{roleName}' đã tồn tại");

public class UserValidationException(string message) : Exception(message);

public class PasswordResetException(string message) : Exception(message);

public class ShiftTemplateNotFoundException(Guid id)
    : Exception($"Shift template with id '{id}' was not found.");

public class ShiftSlotNotFoundException(Guid id)
    : Exception($"Shift slot with id '{id}' was not found.");

public class ShiftRegistrationNotFoundException(Guid id)
    : Exception($"Shift registration with id '{id}' was not found.");
