namespace UserService.Domain.Exceptions;

public class UserNotFoundException(Guid id)
    : Exception($"User with id '{id}' was not found.");

public class InvalidCredentialsException()
    : Exception("Username or password is incorrect.");

public class UserInactiveException()
    : Exception("This account has been deactivated.");

public class DuplicateUsernameException(string username)
    : Exception($"Username '{username}' already exists.");

public class RoleNotFoundException(int id)
    : Exception($"Role with id '{id}' was not found.");
