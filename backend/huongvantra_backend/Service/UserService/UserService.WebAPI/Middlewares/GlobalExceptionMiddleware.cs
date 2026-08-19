using System.Text.Json;
using Microsoft.AspNetCore.Http;
using UserService.Domain.Exceptions;

namespace UserService.WebAPI.Middlewares;

public class GlobalExceptionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (statusCode, message) = ex switch
        {
            UserNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            UserNotFoundByUsernameException e => (StatusCodes.Status404NotFound, e.Message),
            RoleNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            RoleAlreadyDeactivatedException e => (StatusCodes.Status400BadRequest, e.Message),
            PermissionNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            PermissionAlreadyDeactivatedException e => (StatusCodes.Status404NotFound, e.Message),
            EmployeeNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            ShiftTemplateNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            ShiftSlotNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            ShiftRegistrationNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            UserDeactivatedByIdException e => (StatusCodes.Status400BadRequest, e.Message),
            UserAlreadyLockedByIdException e => (StatusCodes.Status400BadRequest, e.Message),
            InvalidCredentialsException e => (StatusCodes.Status401Unauthorized, e.Message),
            UserDeactivatedException e => (StatusCodes.Status401Unauthorized, e.Message),
            InvalidRefreshTokenException e => (StatusCodes.Status401Unauthorized, "Phiên đăng nhập đã hết hạn hoặc tài khoản đã đăng nhập ở thiết bị khác."),
            UserInactiveException e => (StatusCodes.Status403Forbidden, e.Message),
            ForbiddenException e => (StatusCodes.Status403Forbidden, e.Message),
            DuplicateUsernameException e => (StatusCodes.Status409Conflict, e.Message),
            DuplicatePermissionException e => (StatusCodes.Status409Conflict, e.Message),
            DuplicateRoleException e => (StatusCodes.Status409Conflict, e.Message),
            RoleInUseException e => (StatusCodes.Status409Conflict, e.Message),
            UserValidationException e => (StatusCodes.Status400BadRequest, e.Message),
            PasswordResetException e => (StatusCodes.Status400BadRequest, e.Message),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.")
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var response = JsonSerializer.Serialize(
            new { status = statusCode, message },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        return context.Response.WriteAsync(response);
    }
}
