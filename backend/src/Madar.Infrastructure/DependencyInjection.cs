using Madar.Application.Interfaces;
using Madar.Domain.Entities.Identity;
using Madar.Infrastructure.Identity;
using Madar.Infrastructure.Persistence;
using Madar.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Madar.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        // Database
        var connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection not configured.");
        services.AddDbContext<MadarDbContext>(options =>
            options.UseMySql(
                connectionString,
                new MySqlServerVersion(new Version(8, 0, 0)),
                b => b.MigrationsAssembly(typeof(MadarDbContext).Assembly.FullName)));

        // Identity
        services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireUppercase = true;
            options.Password.RequiredLength = 8;
            options.User.RequireUniqueEmail = true;
        })
        .AddEntityFrameworkStores<MadarDbContext>()
        .AddDefaultTokenProviders();

        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IIdentityService, IdentityService>();

        // Memory cache
        services.AddMemoryCache();

        // Salah Time Service (calls aladhan.com)
        services.AddHttpClient<ISalahTimeService, SalahTimeService>();

        // Claude AI Priority Engine (calls api.anthropic.com)
        services.AddHttpClient<IAiPriorityEngine, ClaudeAiPriorityEngine>();

        return services;
    }
}
