using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Madar.Domain.Entities.Core;
using Madar.Domain.Entities.Identity;

namespace Madar.Infrastructure.Persistence;

public class MadarDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public MadarDbContext(DbContextOptions<MadarDbContext> options) : base(options) { }

    public DbSet<Ecosystem> Ecosystems => Set<Ecosystem>();
    public DbSet<EcosystemRole> EcosystemRoles => Set<EcosystemRole>();
    public DbSet<UserEcosystemMember> EcosystemMembers => Set<UserEcosystemMember>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<LifeCircle> LifeCircles => Set<LifeCircle>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<SmartTask> SmartTasks => Set<SmartTask>();
    public DbSet<TaskTag> TaskTags => Set<TaskTag>();
    public DbSet<TaskAttachment> TaskAttachments => Set<TaskAttachment>();
    public DbSet<TaskAiLog> TaskAiLogs => Set<TaskAiLog>();
    public DbSet<DailyEnergyLog> DailyEnergyLogs => Set<DailyEnergyLog>();
    public DbSet<InboxItem> InboxItems => Set<InboxItem>();
    public DbSet<Contract> Contracts => Set<Contract>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // TiDB has new collation enabled and doesn't support ascii_general_ci for GUIDs
        builder.UseGuidCollation(string.Empty);

        builder.Entity<ApplicationUser>(u =>
        {
            u.OwnsOne(x => x.EnergyProfile, ep => { ep.WithOwner(); ep.Property(x => x.AverageSleepHours).HasPrecision(4, 1); });
            u.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        });

        builder.Entity<Ecosystem>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<EcosystemRole>(r =>
        {
            r.HasKey(x => x.Id);
            r.Property(x => x.Name).HasMaxLength(100).IsRequired();
            r.HasOne(x => x.Ecosystem).WithMany(x => x.Roles).HasForeignKey(x => x.EcosystemId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<UserEcosystemMember>(m =>
        {
            m.HasKey(x => x.Id);
            m.HasIndex(x => new { x.EcosystemId, x.UserId }).IsUnique();
            m.HasOne(x => x.Ecosystem).WithMany(x => x.Members).HasForeignKey(x => x.EcosystemId).OnDelete(DeleteBehavior.Cascade);
            m.HasOne(x => x.User).WithMany(x => x.EcosystemMemberships).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            m.HasOne(x => x.Role).WithMany(x => x.Members).HasForeignKey(x => x.EcosystemRoleId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<LifeCircle>(lc =>
        {
            lc.HasKey(x => x.Id);
            lc.Property(x => x.Name).HasMaxLength(150).IsRequired();
            lc.HasOne(x => x.Owner).WithMany(x => x.OwnedCircles).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
            lc.HasOne(x => x.ParentCircle).WithMany(x => x.SubCircles).HasForeignKey(x => x.ParentCircleId).OnDelete(DeleteBehavior.Restrict);
            lc.HasOne(x => x.Ecosystem).WithMany(x => x.LifeCircles).HasForeignKey(x => x.EcosystemId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Goal>(g =>
        {
            g.HasKey(x => x.Id);
            g.Property(x => x.Title).HasMaxLength(300).IsRequired();
            g.HasOne(x => x.LifeCircle).WithMany(x => x.Goals).HasForeignKey(x => x.LifeCircleId).OnDelete(DeleteBehavior.Cascade);
            g.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<SmartTask>(t =>
        {
            t.HasKey(x => x.Id);
            t.Property(x => x.Title).HasMaxLength(500).IsRequired();
            t.Property(x => x.AiPriorityScore).HasPrecision(5, 2);
            t.HasOne(x => x.Owner).WithMany(x => x.Tasks).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne(x => x.LifeCircle).WithMany(x => x.Tasks).HasForeignKey(x => x.LifeCircleId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne(x => x.Goal).WithMany(x => x.LinkedTasks).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.SetNull);
            t.HasOne(x => x.ParentTask).WithMany(x => x.SubTasks).HasForeignKey(x => x.ParentTaskId).OnDelete(DeleteBehavior.Restrict);
            t.HasMany(x => x.Tags).WithMany(x => x.Tasks).UsingEntity(j => j.ToTable("SmartTaskTags"));
            t.HasIndex(x => new { x.OwnerId, x.Status });
            t.HasIndex(x => x.AiPriorityScore);
        });

        builder.Entity<TaskAiLog>(al =>
        {
            al.HasKey(x => x.Id);
            al.HasOne(x => x.Task).WithMany(x => x.AiLogs).HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<DailyEnergyLog>(el =>
        {
            el.HasKey(x => x.Id);
            el.HasIndex(x => new { x.UserId, x.LogDate, x.Block }).IsUnique();
            el.HasOne(x => x.User).WithMany(x => x.EnergyLogs).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<InboxItem>(inbox =>
        {
            inbox.HasKey(x => x.Id);
            inbox.HasOne(x => x.Owner).WithMany(x => x.InboxItems).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            inbox.HasOne(x => x.ConvertedTask).WithMany().HasForeignKey(x => x.ConvertedToTaskId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<Contract>(c =>
        {
            c.HasKey(x => x.Id);
            c.Property(x => x.Title).HasMaxLength(400).IsRequired();
            c.Property(x => x.ClientName).HasMaxLength(300).IsRequired();
            c.Property(x => x.Currency).HasMaxLength(10);
            c.Property(x => x.Value).HasPrecision(18, 2);
            c.HasOne(x => x.Owner).WithMany(x => x.Contracts).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
            c.HasIndex(x => new { x.OwnerId, x.Status });
        });
    }
}
