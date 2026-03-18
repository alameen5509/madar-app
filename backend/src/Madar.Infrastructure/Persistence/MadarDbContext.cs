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
    public DbSet<Habit> Habits => Set<Habit>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<WatchLinkRequest_Entity> WatchLinkRequests => Set<WatchLinkRequest_Entity>();

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
            t.Property(x => x.Cost).HasPrecision(18, 2);
            t.Property(x => x.CostCurrency).HasMaxLength(10);
            t.HasOne(x => x.AssignedTo).WithMany().HasForeignKey(x => x.AssignedToId).OnDelete(DeleteBehavior.SetNull);
            t.HasOne(x => x.Project).WithMany(x => x.Tasks).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);
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

        builder.Entity<Habit>(h =>
        {
            h.HasKey(x => x.Id);
            h.Property(x => x.Title).HasMaxLength(300).IsRequired();
            h.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
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

        builder.Entity<Project>(p =>
        {
            p.HasKey(x => x.Id);
            p.Property(x => x.Title).HasMaxLength(400).IsRequired();
            p.Property(x => x.Budget).HasPrecision(18, 2);
            p.Property(x => x.Currency).HasMaxLength(10);
            p.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<DeviceToken>(dt =>
        {
            dt.HasKey(x => x.Id);
            dt.Property(x => x.Token).HasMaxLength(512).IsRequired();
            dt.Property(x => x.Platform).HasMaxLength(20).IsRequired();
            dt.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            dt.HasIndex(x => new { x.UserId, x.Token }).IsUnique();
        });

        builder.Entity<NotificationPreference>(np =>
        {
            np.HasKey(x => x.Id);
            np.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            np.HasIndex(x => x.UserId).IsUnique();
        });

        builder.Entity<WatchLinkRequest_Entity>(wlr =>
        {
            wlr.HasKey(x => x.Id);
            wlr.Property(x => x.DeviceId).HasMaxLength(200).IsRequired();
            wlr.Property(x => x.DeviceName).HasMaxLength(200);
            wlr.Property(x => x.Status).HasMaxLength(20);
        });
    }
}
