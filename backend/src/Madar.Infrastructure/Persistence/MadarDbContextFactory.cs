using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Madar.Infrastructure.Persistence;

public class MadarDbContextFactory : IDesignTimeDbContextFactory<MadarDbContext>
{
    public MadarDbContext CreateDbContext(string[] args)
    {
        var connectionString = "Server=gateway01.eu-central-1.prod.aws.tidbcloud.com;Port=4000;Database=test;Uid=3iP7gbQYUFyyRRi.root;Pwd=kFRnSE85F22CSfSk;SslMode=Required;";
        var optionsBuilder = new DbContextOptionsBuilder<MadarDbContext>();
        // TiDB is MySQL 8.0 compatible — use fixed version to avoid design-time connection
        optionsBuilder.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 21)));
        return new MadarDbContext(optionsBuilder.Options);
    }
}
