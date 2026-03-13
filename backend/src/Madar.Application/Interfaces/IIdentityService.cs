using Madar.Application.Common.Models;

namespace Madar.Application.Interfaces;

public interface IIdentityService
{
    Task<Result<string>> RegisterAsync(string fullName, string email, string password, string role);
    Task<Result<TokenResponse>> LoginAsync(string email, string password);
    Task<Result<TokenResponse>> RefreshTokenAsync(string token, string refreshToken);
    Task<Result> RevokeTokenAsync(string email);
    Task<bool> IsInRoleAsync(string userId, string role);
    Task<string?> GetUserNameAsync(string userId);
}
