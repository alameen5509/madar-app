using Microsoft.AspNetCore.Identity;
using Madar.Application.Common.Models;
using Madar.Application.Interfaces;
using Madar.Domain.Entities.Identity;

namespace Madar.Infrastructure.Identity;

public class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ITokenService _tokenService;

    public IdentityService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ITokenService tokenService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
    }

    public async Task<Result<string>> RegisterAsync(string fullName, string email, string password, string role)
    {
        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser != null)
            return Result<string>.Failure("User with this email already exists.");

        var user = new ApplicationUser
        {
            FullName = fullName,
            Email = email,
            UserName = email,
        };

        var result = await _userManager.CreateAsync(user, password);
        if (!result.Succeeded)
            return Result<string>.Failure(result.Errors.Select(e => e.Description).ToList());

        await _userManager.AddToRoleAsync(user, role);
        return Result<string>.Success(user.Id.ToString(), "User registered successfully.");
    }

    public async Task<Result<TokenResponse>> LoginAsync(string email, string password)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null || !user.IsActive)
            return Result<TokenResponse>.Failure("Invalid credentials.");

        var result = await _signInManager.CheckPasswordSignInAsync(user, password, false);
        if (!result.Succeeded)
            return Result<TokenResponse>.Failure("Invalid credentials.");

        user.LastLoginAt = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        var refreshToken = _tokenService.GenerateRefreshToken();

        return Result<TokenResponse>.Success(new TokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            AccessTokenExpiry = DateTime.UtcNow.AddMinutes(60)
        });
    }

    public async Task<Result<TokenResponse>> RefreshTokenAsync(string token, string refreshToken)
    {
        var principal = _tokenService.GetPrincipalFromExpiredToken(token);
        var email = principal.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        if (email == null) return Result<TokenResponse>.Failure("Invalid token.");

        var user = await _userManager.FindByEmailAsync(email);
        if (user == null || !user.IsActive)
            return Result<TokenResponse>.Failure("User not found or inactive.");

        var roles = await _userManager.GetRolesAsync(user);
        var newAccessToken = _tokenService.GenerateAccessToken(user, roles);
        var newRefreshToken = _tokenService.GenerateRefreshToken();

        return Result<TokenResponse>.Success(new TokenResponse
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            AccessTokenExpiry = DateTime.UtcNow.AddMinutes(60)
        });
    }

    public async Task<Result> RevokeTokenAsync(string email)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null) return Result.Failure("User not found.");
        return Result.Success();
    }

    public async Task<bool> IsInRoleAsync(string userId, string role)
    {
        var user = await _userManager.FindByIdAsync(userId);
        return user != null && await _userManager.IsInRoleAsync(user, role);
    }

    public async Task<string?> GetUserNameAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        return user?.UserName;
    }
}
