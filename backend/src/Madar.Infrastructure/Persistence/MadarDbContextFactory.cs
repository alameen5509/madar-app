using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Madar.Infrastructure.Persistence;

public class MadarDbContextFactory : IDesignTimeDbContextFactory<MadarDbContext>
{
    public MadarDbContext CreateDbContext(string[] args)
    {
        var connectionString = "Server=gateway01.eu-central-1.prod.aws.tidbcloud.com;Port=4000;Database=test;Uid=3iP7gbQYUFyyRRi.root;Pwd=kFRnSE85F22CSfSk;SslMode=Required;";
        var optionsBuilder = new DbContextOptionsBuilder<MadarDbContext>();
        optionsBuilder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
        return new MadarDbContext(optionsBuilder.Options);
    }
}
