using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Madar.Infrastructure.Persistence;

public class MadarDbContextFactory : IDesignTimeDbContextFactory<MadarDbContext>
{
    public MadarDbContext CreateDbContext(string[] args)
    {
        var connectionString = "Host=aws-0-eu-central-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.yxprisuqztdxevxqgmmc;Password=WOdD1PUu*0Z%bN6Bnp2YltxksfV&;SSL Mode=Require;Trust Server Certificate=true";
        var optionsBuilder = new DbContextOptionsBuilder<MadarDbContext>();
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
        optionsBuilder.UseNpgsql(connectionString);
        return new MadarDbContext(optionsBuilder.Options);
    }
}
