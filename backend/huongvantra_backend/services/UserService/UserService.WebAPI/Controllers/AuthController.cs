using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthLogic authLogic) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await authLogic.LoginAsync(request);
        return Ok(result);
    }
}
