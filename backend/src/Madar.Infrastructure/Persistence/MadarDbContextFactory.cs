using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Madar.Infrastructure.Persistence;

public class MadarDbContextFactory : IDesignTimeDbContextFactory<MadarDbContext>
{
    public MadarDbContext CreateDbContext(string[] args)
    {
        var connectionString = "Host=db.yxprisuqztdxevxqgmmc.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=v2CU5NUZHOKlR1BZeyL5V6kzRBnZno9F;SSL Mode=Require;Trust Server Certificate=true";
        var optionsBuilder = new DbContextOptionsBuilder<MadarDbContext>();
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
        optionsBuilder.UseNpgsql(connectionString);
        return new MadarDbContext(optionsBuilder.Options);
    }
}
