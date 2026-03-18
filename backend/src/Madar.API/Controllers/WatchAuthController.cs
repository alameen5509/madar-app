using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Madar.Application.Common.Models;
using Madar.Application.Interfaces;
using Madar.Domain.Entities.Core;
using Madar.Domain.Entities.Identity;
using Madar.Infrastructure.Persistence;

namespace Madar.API.Controllers;

[ApiController]
[Route("api/watch-auth")]
public class WatchAuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;
    private readonly MadarDbContext _db;

    // In-memory store for watch login codes (production: use Redis/DB)
    private static readonly ConcurrentDictionary<string, WatchLoginCode> _pendingCodes = new();

    public WatchAuthController(
        UserManager<ApplicationUser> userManager,
        ITokenService tokenService,
        MadarDbContext db)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _db = db;
    }

    /// <summary>
    /// Web user enters the 6-digit code from the watch to link their account.
    /// Creates the code entry and links it in one step.
    /// </summary>
    [Authorize]
    [HttpPost("link")]
    public IActionResult LinkCode([FromBody] WatchLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { succeeded = false, message = "الرمز مطلوب" });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        CleanExpiredCodes();

        // Check if code was already linked
        if (_pendingCodes.TryGetValue(request.Code, out var existing) && existing.IsUsed)
            return BadRequest(new { succeeded = false, message = "تم استخدام هذا الرمز مسبقاً" });

        // Create or update the code entry with user linkage
        var loginCode = new WatchLoginCode
        {
            Code = request.Code,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = true
        };

        _pendingCodes[request.Code] = loginCode;

        return Ok(new { succeeded = true, message = "تم ربط الساعة بنجاح" });
    }

    /// <summary>
    /// Watch polls this with its locally-generated code to check if linked, and gets tokens.
    /// </summary>
    [HttpGet("poll/{code}")]
    public async Task<IActionResult> PollCode(string code)
    {
        if (!_pendingCodes.TryGetValue(code, out var loginCode))
            return Ok(new { status = "pending", message = "في انتظار ربط الحساب" });

        if (!loginCode.IsUsed || string.IsNullOrEmpty(loginCode.UserId))
            return Ok(new { status = "pending", message = "في انتظار ربط الحساب" });

        // Code has been linked — generate tokens (keep code for 1 min for retry)
        var user = await _userManager.FindByIdAsync(loginCode.UserId);
        if (user == null || !user.IsActive)
            return BadRequest(new { status = "error", message = "المستخدم غير موجود أو غير نشط" });

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        var refreshToken = _tokenService.GenerateRefreshToken();

        // Keep code alive for 1 more minute so watch can retry if needed
        loginCode.ExpiresAt = DateTime.UtcNow.AddMinutes(1);

        return Ok(new
        {
            status = "linked",
            message = "تم ربط الساعة بنجاح",
            data = new
            {
                accessToken,
                refreshToken,
                accessTokenExpiry = DateTime.UtcNow.AddMinutes(1440)
            }
        });
    }

    /// <summary>
    /// Generate a temporary code for QR login. Requires authenticated user.
    /// </summary>
    [Authorize]
    [HttpPost("generate")]
    public IActionResult GenerateCode()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        CleanExpiredCodes();

        var codeBytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(codeBytes);
        var code = Convert.ToBase64String(codeBytes)
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

        var loginCode = new WatchLoginCode
        {
            Code = code,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false
        };

        _pendingCodes[code] = loginCode;

        return Ok(new
        {
            code,
            expiresAt = loginCode.ExpiresAt,
            expiresInSeconds = 300
        });
    }

    /// <summary>
    /// Watch validates QR code.
    /// </summary>
    [HttpPost("validate")]
    public async Task<IActionResult> ValidateCode([FromBody] WatchValidateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(Result<TokenResponse>.Failure("الرمز مطلوب"));

        if (!_pendingCodes.TryGetValue(request.Code, out var loginCode))
            return BadRequest(Result<TokenResponse>.Failure("رمز غير صالح"));

        if (loginCode.IsUsed)
            return BadRequest(Result<TokenResponse>.Failure("تم استخدام هذا الرمز مسبقاً"));

        if (DateTime.UtcNow > loginCode.ExpiresAt)
        {
            _pendingCodes.TryRemove(request.Code, out _);
            return BadRequest(Result<TokenResponse>.Failure("انتهت صلاحية الرمز"));
        }

        loginCode.IsUsed = true;
        _pendingCodes.TryRemove(request.Code, out _);

        var user = await _userManager.FindByIdAsync(loginCode.UserId!);
        if (user == null || !user.IsActive)
            return BadRequest(Result<TokenResponse>.Failure("المستخدم غير موجود أو غير نشط"));

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        var refreshToken = _tokenService.GenerateRefreshToken();

        return Ok(Result<TokenResponse>.Success(new TokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            AccessTokenExpiry = DateTime.UtcNow.AddMinutes(1440)
        }, "تم ربط الساعة بنجاح"));
    }

    /// <summary>
    /// Check code status from web page.
    /// </summary>
    [Authorize]
    [HttpGet("status/{code}")]
    public IActionResult CheckStatus(string code)
    {
        if (!_pendingCodes.TryGetValue(code, out var loginCode))
            return Ok(new { status = "used", message = "تم ربط الساعة بنجاح" });

        if (DateTime.UtcNow > loginCode.ExpiresAt)
        {
            _pendingCodes.TryRemove(code, out _);
            return Ok(new { status = "expired", message = "انتهت صلاحية الرمز" });
        }

        return Ok(new { status = "pending", message = "في انتظار مسح الرمز" });
    }

    /// <summary>
    /// Watch requests a link — stores device info, user approves from app.
    /// </summary>
    [HttpPost("request-link")]
    public async Task<IActionResult> RequestLink([FromBody] WatchRequestLinkRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceId))
            return BadRequest(new { error = "DeviceId مطلوب" });

        var linkReq = new WatchLinkRequest_Entity
        {
            Id = Guid.NewGuid(),
            DeviceId = request.DeviceId,
            DeviceName = request.DeviceName ?? "ساعة غير معروفة",
            Status = "pending",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
        };

        _db.WatchLinkRequests.Add(linkReq);
        await _db.SaveChangesAsync(ct);

        return Ok(new { requestId = linkReq.Id, status = "pending", message = "في انتظار موافقة المستخدم" });
    }

    /// <summary>User approves the watch link request from the app.</summary>
    [Authorize]
    [HttpPost("approve-link")]
    public async Task<IActionResult> ApproveLink([FromBody] WatchApproveLinkRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var linkReq = await _db.WatchLinkRequests.FindAsync(new object[] { request.RequestId }, ct);

        if (linkReq is null || linkReq.Status != "pending" || DateTime.UtcNow > linkReq.ExpiresAt)
            return BadRequest(new { error = "طلب غير صالح أو منتهي" });

        linkReq.UserId = Guid.Parse(userId!);
        linkReq.Status = "approved";
        await _db.SaveChangesAsync(ct);

        // Generate tokens for the watch
        var user = await _userManager.FindByIdAsync(userId!);
        if (user is null) return BadRequest(new { error = "المستخدم غير موجود" });

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        var refreshToken = _tokenService.GenerateRefreshToken();

        return Ok(new
        {
            message = "تم الموافقة على ربط الساعة",
            data = new { accessToken, refreshToken, accessTokenExpiry = DateTime.UtcNow.AddMinutes(1440) },
        });
    }

    /// <summary>User rejects the watch link request.</summary>
    [Authorize]
    [HttpPost("reject-link")]
    public async Task<IActionResult> RejectLink([FromBody] WatchApproveLinkRequest request, CancellationToken ct)
    {
        var linkReq = await _db.WatchLinkRequests.FindAsync(new object[] { request.RequestId }, ct);
        if (linkReq is null) return NotFound();

        linkReq.Status = "rejected";
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "تم رفض طلب الربط" });
    }

    /// <summary>Watch polls to see if its request was approved.</summary>
    [HttpGet("poll-request/{requestId:guid}")]
    public async Task<IActionResult> PollRequest(Guid requestId, CancellationToken ct)
    {
        var linkReq = await _db.WatchLinkRequests.FindAsync(new object[] { requestId }, ct);
        if (linkReq is null) return NotFound();

        if (linkReq.Status == "approved" && linkReq.UserId.HasValue)
        {
            var user = await _userManager.FindByIdAsync(linkReq.UserId.Value.ToString());
            if (user is null) return BadRequest(new { status = "error" });

            var roles = await _userManager.GetRolesAsync(user);
            var accessToken = _tokenService.GenerateAccessToken(user, roles);
            var refreshToken = _tokenService.GenerateRefreshToken();

            return Ok(new
            {
                status = "approved",
                data = new { accessToken, refreshToken, accessTokenExpiry = DateTime.UtcNow.AddMinutes(1440) },
            });
        }

        return Ok(new { status = linkReq.Status });
    }

    private static void CleanExpiredCodes()
    {
        var expired = _pendingCodes
            .Where(kvp => DateTime.UtcNow > kvp.Value.ExpiresAt)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expired)
            _pendingCodes.TryRemove(key, out _);
    }
}

public class WatchLoginCode
{
    public string Code { get; set; } = "";
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
}

public class WatchValidateRequest
{
    public string Code { get; set; } = "";
}

public class WatchLinkRequest
{
    public string Code { get; set; } = "";
}

public class WatchRequestLinkRequest
{
    public string DeviceId { get; set; } = "";
    public string? DeviceName { get; set; }
}

public class WatchApproveLinkRequest
{
    public Guid RequestId { get; set; }
}
