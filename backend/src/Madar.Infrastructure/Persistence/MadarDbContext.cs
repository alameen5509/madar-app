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
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<WatchLinkRequest_Entity> WatchLinkRequests => Set<WatchLinkRequest_Entity>();

    // Finance module
    public DbSet<FinAccount> FinAccounts => Set<FinAccount>();
    public DbSet<FinPocket> FinPockets => Set<FinPocket>();
    public DbSet<PocketCommitment> PocketCommitments => Set<PocketCommitment>();
    public DbSet<FinTransaction> FinTransactions => Set<FinTransaction>();
    public DbSet<FinDebt> FinDebts => Set<FinDebt>();
    public DbSet<FinRecurringDue> FinRecurringDues => Set<FinRecurringDue>();
    public DbSet<FinGoal> FinGoals => Set<FinGoal>();
    public DbSet<FinGoalItem> FinGoalItems => Set<FinGoalItem>();
    public DbSet<ZakatProfile> ZakatProfiles => Set<ZakatProfile>();
    public DbSet<GoldPurchase> GoldPurchases => Set<GoldPurchase>();
    public DbSet<FinSettings> FinSettings => Set<FinSettings>();

    // Works
    public DbSet<Work> Works => Set<Work>();
    public DbSet<WorkJob> WorkJobs => Set<WorkJob>();

    // Job dimensions & goals
    public DbSet<JobDimension> JobDimensions => Set<JobDimension>();
    public DbSet<JobGoal> JobGoals => Set<JobGoal>();
    public DbSet<JobGoalProject> JobGoalProjects => Set<JobGoalProject>();
    public DbSet<JobGoalTask> JobGoalTasks => Set<JobGoalTask>();

    // Life-role dimensions & goals (mirrors job system; RoleId → UserCircles.Id raw-SQL table)
    public DbSet<RoleDimension> RoleDimensions => Set<RoleDimension>();
    public DbSet<RoleGoal> RoleGoals => Set<RoleGoal>();
    public DbSet<RoleGoalProject> RoleGoalProjects => Set<RoleGoalProject>();
    public DbSet<RoleGoalTask> RoleGoalTasks => Set<RoleGoalTask>();

    // Prayer tracking
    public DbSet<PrayerLog> PrayerLogs => Set<PrayerLog>();
    public DbSet<PrayerPenalty> PrayerPenalties => Set<PrayerPenalty>();
    public DbSet<PrayerSettings> PrayerSettings => Set<PrayerSettings>();

    // Meetings
    public DbSet<Meeting> Meetings => Set<Meeting>();
    public DbSet<MeetingAttendee> MeetingAttendees => Set<MeetingAttendee>();
    public DbSet<MeetingAgendaItem> MeetingAgenda => Set<MeetingAgendaItem>();
    public DbSet<MeetingMinute> MeetingMinutes => Set<MeetingMinute>();
    public DbSet<MeetingActionItem> MeetingActionItems => Set<MeetingActionItem>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Preserve table names for PostgreSQL (case-sensitive)
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            entity.SetTableName(entity.GetTableName());
        }

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
            g.Property(x => x.FocusType).HasMaxLength(20);
            g.HasOne(x => x.LifeCircle).WithMany(x => x.Goals).HasForeignKey(x => x.LifeCircleId).OnDelete(DeleteBehavior.SetNull);
            g.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<SmartTask>(t =>
        {
            t.HasKey(x => x.Id);
            t.Property(x => x.Title).HasMaxLength(500).IsRequired();
            t.Property(x => x.AiPriorityScore).HasPrecision(5, 2);
            t.HasOne(x => x.Owner).WithMany(x => x.Tasks).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
            t.HasOne(x => x.LifeCircle).WithMany(x => x.Tasks).HasForeignKey(x => x.LifeCircleId).OnDelete(DeleteBehavior.SetNull);
            t.HasOne(x => x.Goal).WithMany(x => x.LinkedTasks).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.SetNull);
            t.HasOne(x => x.ParentTask).WithMany(x => x.SubTasks).HasForeignKey(x => x.ParentTaskId).OnDelete(DeleteBehavior.Restrict);
            t.HasMany(x => x.Tags).WithMany(x => x.Tasks).UsingEntity(j => j.ToTable("SmartTaskTags"));
            t.HasIndex(x => new { x.OwnerId, x.Status });
            t.HasIndex(x => x.AiPriorityScore);
            t.Property(x => x.Cost).HasPrecision(18, 2);
            t.Property(x => x.CostCurrency).HasMaxLength(10);
            t.HasOne(x => x.AssignedTo).WithMany().HasForeignKey(x => x.AssignedToId).OnDelete(DeleteBehavior.SetNull);
            t.HasOne(x => x.Project).WithMany(x => x.Tasks).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);
            t.HasOne(x => x.Contact).WithMany(x => x.LinkedTasks).HasForeignKey(x => x.ContactId).OnDelete(DeleteBehavior.SetNull);
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

        // ═══ Finance Module ═══
        builder.Entity<FinAccount>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Icon).HasMaxLength(10);
            e.Property(x => x.Balance).HasPrecision(18, 2);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FinPocket>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Icon).HasMaxLength(10);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PocketCommitment>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.Property(x => x.MonthlyAmount).HasPrecision(18, 2);
            e.Property(x => x.TotalAmount).HasPrecision(18, 2);
            e.Property(x => x.PaidSoFar).HasPrecision(18, 2);
            e.HasOne(x => x.Pocket).WithMany(x => x.Commitments).HasForeignKey(x => x.PocketId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FinTransaction>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(500).IsRequired();
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Category).HasMaxLength(100);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Account).WithMany(x => x.Transactions).HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Pocket).WithMany().HasForeignKey(x => x.PocketId).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(x => new { x.OwnerId, x.Date });
        });

        builder.Entity<FinDebt>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.CreditorName).HasMaxLength(200).IsRequired();
            e.Property(x => x.CreditorPhone).HasMaxLength(30);
            e.Property(x => x.Notes).HasMaxLength(500);
            e.Property(x => x.OriginalAmount).HasPrecision(18, 2);
            e.Property(x => x.PaidSoFar).HasPrecision(18, 2);
            e.Property(x => x.MonthlyPayment).HasPrecision(18, 2);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FinRecurringDue>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Category).HasMaxLength(100);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FinGoal>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.TargetAmount).HasPrecision(18, 2);
            e.Property(x => x.SavedSoFar).HasPrecision(18, 2);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FinGoalItem>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(300).IsRequired();
            e.Property(x => x.Cost).HasPrecision(18, 2);
            e.HasOne(x => x.Goal).WithMany(x => x.Items).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ZakatProfile>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.HawalDate).HasMaxLength(20);
            e.Property(x => x.GoldGrams).HasPrecision(10, 4);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.OwnerId).IsUnique();
        });

        builder.Entity<GoldPurchase>(e => {
            e.HasKey(x => x.Id);
            e.Property(x => x.Grams).HasPrecision(10, 4);
            e.Property(x => x.PricePerGram).HasPrecision(18, 2);
            e.Property(x => x.TotalCost).HasPrecision(18, 2);
            e.Property(x => x.Notes).HasMaxLength(300);
            e.HasOne(x => x.ZakatProfile).WithMany(x => x.GoldPurchases).HasForeignKey(x => x.ZakatProfileId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FinSettings>(e => {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.OwnerId).IsUnique();
        });

        builder.Entity<Contact>(ct =>
        {
            ct.HasKey(x => x.Id);
            ct.Property(x => x.Name).HasMaxLength(200).IsRequired();
            ct.Property(x => x.Phone).HasMaxLength(30).IsRequired();
            ct.Property(x => x.Notes).HasMaxLength(500);
            ct.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            ct.HasIndex(x => new { x.OwnerId, x.Phone }).IsUnique();
        });

        // ═══ Works ═══
        builder.Entity<Work>(w => {
            w.HasKey(x => x.Id);
            w.Property(x => x.Name).HasMaxLength(200).IsRequired();
            w.Property(x => x.Type).HasMaxLength(20).IsRequired();
            w.Property(x => x.Title).HasMaxLength(200);
            w.Property(x => x.Employer).HasMaxLength(200);
            w.Property(x => x.Salary).HasPrecision(18, 2);
            w.Property(x => x.Status).HasMaxLength(20);
            w.Property(x => x.Sector).HasMaxLength(100);
            w.Property(x => x.Role).HasMaxLength(100);
            w.Property(x => x.OwnershipPercentage).HasPrecision(5, 2);
            w.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            w.HasIndex(x => x.OwnerId);
        });

        builder.Entity<WorkJob>(wj => {
            wj.HasKey(x => x.Id);
            wj.Property(x => x.Title).HasMaxLength(200).IsRequired();
            wj.Property(x => x.Description).HasMaxLength(1000);
            wj.Property(x => x.Salary).HasPrecision(18, 2);
            wj.Property(x => x.Status).HasMaxLength(20);
            wj.HasOne(x => x.Work).WithMany(x => x.Jobs).HasForeignKey(x => x.WorkId).OnDelete(DeleteBehavior.Cascade);
        });

        // ═══ Job Dimensions & Goals ═══
        builder.Entity<JobDimension>(jd => {
            jd.HasKey(x => x.Id);
            jd.Property(x => x.Name).HasMaxLength(200).IsRequired();
            jd.Property(x => x.Icon).HasMaxLength(10);
            jd.Property(x => x.Color).HasMaxLength(20);
            jd.HasOne(x => x.Job).WithMany().HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Cascade);
            jd.HasOne(x => x.ParentDimension).WithMany(x => x.SubDimensions).HasForeignKey(x => x.ParentDimensionId).OnDelete(DeleteBehavior.Restrict);
            jd.HasIndex(x => x.JobId);
        });

        builder.Entity<JobGoal>(jg => {
            jg.HasKey(x => x.Id);
            jg.Property(x => x.Title).HasMaxLength(400).IsRequired();
            jg.Property(x => x.Description).HasMaxLength(1000);
            jg.Property(x => x.Status).HasMaxLength(30);
            jg.Property(x => x.Timeframe).HasMaxLength(50);
            jg.HasOne(x => x.Job).WithMany().HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Cascade);
            jg.HasOne(x => x.Dimension).WithMany(x => x.Goals).HasForeignKey(x => x.DimensionId).OnDelete(DeleteBehavior.Restrict);
            jg.HasOne(x => x.ParentGoal).WithMany(x => x.SubGoals).HasForeignKey(x => x.ParentGoalId).OnDelete(DeleteBehavior.Restrict);
            jg.HasIndex(x => x.DimensionId);
        });

        builder.Entity<JobGoalProject>(jp => {
            jp.HasKey(x => x.Id);
            jp.HasOne(x => x.Goal).WithMany(x => x.Projects).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.Cascade);
            jp.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            jp.HasIndex(x => new { x.GoalId, x.ProjectId }).IsUnique();
        });

        builder.Entity<JobGoalTask>(jt => {
            jt.HasKey(x => x.Id);
            jt.HasOne(x => x.Goal).WithMany(x => x.Tasks).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.Cascade);
            jt.HasOne(x => x.Task).WithMany().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Cascade);
            jt.HasIndex(x => new { x.GoalId, x.TaskId }).IsUnique();
        });

        // ═══ Role Dimensions & Goals (mirrors Job system) ═══
        builder.Entity<RoleDimension>(rd => {
            rd.HasKey(x => x.Id);
            rd.Property(x => x.Name).HasMaxLength(200).IsRequired();
            rd.Property(x => x.Icon).HasMaxLength(10);
            rd.Property(x => x.Color).HasMaxLength(20);
            rd.HasOne(x => x.ParentDimension).WithMany(x => x.SubDimensions).HasForeignKey(x => x.ParentDimensionId).OnDelete(DeleteBehavior.Restrict);
            rd.HasIndex(x => x.RoleId);
        });

        builder.Entity<RoleGoal>(rg => {
            rg.HasKey(x => x.Id);
            rg.Property(x => x.Title).HasMaxLength(400).IsRequired();
            rg.Property(x => x.Description).HasMaxLength(1000);
            rg.Property(x => x.Status).HasMaxLength(30);
            rg.Property(x => x.Timeframe).HasMaxLength(50);
            rg.HasOne(x => x.Dimension).WithMany(x => x.Goals).HasForeignKey(x => x.DimensionId).OnDelete(DeleteBehavior.Restrict);
            rg.HasOne(x => x.ParentGoal).WithMany(x => x.SubGoals).HasForeignKey(x => x.ParentGoalId).OnDelete(DeleteBehavior.Restrict);
            rg.HasIndex(x => x.DimensionId);
        });

        builder.Entity<RoleGoalProject>(rp => {
            rp.HasKey(x => x.Id);
            rp.HasOne(x => x.Goal).WithMany(x => x.Projects).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.Cascade);
            rp.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            rp.HasIndex(x => new { x.GoalId, x.ProjectId }).IsUnique();
        });

        builder.Entity<RoleGoalTask>(rt => {
            rt.HasKey(x => x.Id);
            rt.HasOne(x => x.Goal).WithMany(x => x.Tasks).HasForeignKey(x => x.GoalId).OnDelete(DeleteBehavior.Cascade);
            rt.HasOne(x => x.Task).WithMany().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Cascade);
            rt.HasIndex(x => new { x.GoalId, x.TaskId }).IsUnique();
        });

        // ═══ Prayer Tracking ═══
        builder.Entity<PrayerLog>(pl => {
            pl.HasKey(x => x.Id);
            pl.Property(x => x.Prayer).HasMaxLength(20).IsRequired();
            pl.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            pl.HasIndex(x => new { x.OwnerId, x.Date, x.Prayer }).IsUnique();
        });

        builder.Entity<PrayerPenalty>(pp => {
            pp.HasKey(x => x.Id);
            pp.Property(x => x.Prayer).HasMaxLength(20).IsRequired();
            pp.Property(x => x.Reason).HasMaxLength(30).IsRequired();
            pp.Property(x => x.PenaltyType).HasMaxLength(50).IsRequired();
            pp.Property(x => x.PenaltyDetail).HasMaxLength(200);
            pp.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            pp.HasIndex(x => new { x.OwnerId, x.Fulfilled });
        });

        builder.Entity<PrayerSettings>(ps => {
            ps.HasKey(x => x.Id);
            ps.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            ps.HasIndex(x => x.OwnerId).IsUnique();
        });

        builder.Entity<WatchLinkRequest_Entity>(wlr =>
        {
            wlr.HasKey(x => x.Id);
            wlr.Property(x => x.DeviceId).HasMaxLength(200).IsRequired();
            wlr.Property(x => x.DeviceName).HasMaxLength(200);
            wlr.Property(x => x.Status).HasMaxLength(20);
        });

        // ═══ Meetings ═══
        builder.Entity<Meeting>(m => {
            m.HasKey(x => x.Id);
            m.Property(x => x.Title).HasMaxLength(400).IsRequired();
            m.Property(x => x.Description).HasMaxLength(2000);
            m.Property(x => x.Platform).HasMaxLength(50);
            m.Property(x => x.Location).HasMaxLength(500);
            m.Property(x => x.MeetingLink).HasMaxLength(500);
            m.Property(x => x.Notes).HasMaxLength(5000);
            m.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            m.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);
            m.HasOne(x => x.Work).WithMany().HasForeignKey(x => x.WorkId).OnDelete(DeleteBehavior.SetNull);
            m.HasOne(x => x.Circle).WithMany().HasForeignKey(x => x.CircleId).OnDelete(DeleteBehavior.SetNull);
            m.HasIndex(x => x.OwnerId);
            m.HasIndex(x => x.StartTime);
        });

        builder.Entity<MeetingAttendee>(a => {
            a.HasKey(x => x.Id);
            a.Property(x => x.Name).HasMaxLength(200).IsRequired();
            a.Property(x => x.Notes).HasMaxLength(500);
            a.HasOne(x => x.Meeting).WithMany(x => x.Attendees).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Cascade);
            a.HasOne(x => x.Contact).WithMany().HasForeignKey(x => x.ContactId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<MeetingAgendaItem>(ai => {
            ai.HasKey(x => x.Id);
            ai.ToTable("MeetingAgenda");
            ai.Property(x => x.Title).HasMaxLength(400).IsRequired();
            ai.Property(x => x.Description).HasMaxLength(1000);
            ai.HasOne(x => x.Meeting).WithMany(x => x.Agenda).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<MeetingMinute>(mn => {
            mn.HasKey(x => x.Id);
            mn.Property(x => x.Content).HasMaxLength(5000).IsRequired();
            mn.HasOne(x => x.Meeting).WithMany(x => x.Minutes).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<MeetingActionItem>(act => {
            act.HasKey(x => x.Id);
            act.Property(x => x.Title).HasMaxLength(400).IsRequired();
            act.Property(x => x.AssignedTo).HasMaxLength(200);
            act.HasOne(x => x.Meeting).WithMany(x => x.ActionItems).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Cascade);
            act.HasOne(x => x.Task).WithMany().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
