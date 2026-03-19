using Madar.Domain.Entities.Identity;

namespace Madar.Domain.Entities.Core;

// ═══ Enums ═══

public enum FinTransactionType { Income, Expense, Transfer, DebtPayment, Installment, Gift }
public enum ExpenseClass { Essential, Luxury, Improvement }
public enum PocketType { Personal, Debt, Savings, Installment, Emergency }
public enum DueType { Salary, Bill, Installment, ExpectedIncome, ExpectedExpense }
public enum DueFrequency { Monthly, Yearly, Once }

// ═══ Account (أين المال) ═══

public class FinAccount
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = default!;
    public string Icon { get; set; } = "🏦";
    public decimal Balance { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<FinTransaction> Transactions { get; set; } = [];
}

// ═══ Pocket (محفظة — لمن المال) ═══

public class FinPocket
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = default!;
    public string Icon { get; set; } = "👤";
    public PocketType Type { get; set; } = PocketType.Personal;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<PocketCommitment> Commitments { get; set; } = [];
}

public class PocketCommitment
{
    public Guid Id { get; set; }
    public Guid PocketId { get; set; }
    public string Title { get; set; } = default!;
    public decimal MonthlyAmount { get; set; }
    public decimal? TotalAmount { get; set; }
    public decimal PaidSoFar { get; set; }
    public int DueDay { get; set; } = 1;
    public FinPocket Pocket { get; set; } = default!;
}

// ═══ Transaction (معاملة مالية) ═══

public class FinTransaction
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = default!;
    public decimal Amount { get; set; }
    public FinTransactionType Type { get; set; }
    public string Category { get; set; } = "أخرى";
    public ExpenseClass? ExpenseClass { get; set; }
    public Guid? AccountId { get; set; }
    public Guid? PocketId { get; set; }
    public DateTime Date { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public FinAccount? Account { get; set; }
    public FinPocket? Pocket { get; set; }
}

// ═══ Debt (دين) ═══

public class FinDebt
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string CreditorName { get; set; } = default!;
    public string? CreditorPhone { get; set; }
    public decimal OriginalAmount { get; set; }
    public decimal PaidSoFar { get; set; }
    public decimal MonthlyPayment { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
}

// ═══ Recurring Due (مستحق متكرر) ═══

public class FinRecurringDue
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = default!;
    public decimal Amount { get; set; }
    public DueType Type { get; set; }
    public DueFrequency Frequency { get; set; } = DueFrequency.Monthly;
    public int DueDay { get; set; } = 1;
    public int? DueMonth { get; set; }
    public Guid? AccountId { get; set; }
    public Guid? PocketId { get; set; }
    public string? Category { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastConfirmedDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
}

// ═══ Financial Goal (هدف مالي) ═══

public class FinGoal
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public decimal TargetAmount { get; set; }
    public decimal SavedSoFar { get; set; }
    public DateTime? Deadline { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<FinGoalItem> Items { get; set; } = [];
}

public class FinGoalItem
{
    public Guid Id { get; set; }
    public Guid GoalId { get; set; }
    public string Name { get; set; } = default!;
    public decimal Cost { get; set; }
    public FinGoal Goal { get; set; } = default!;
}

// ═══ Zakat Profile (زكاة) ═══

public class ZakatProfile
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string? HawalDate { get; set; }
    public decimal GoldGrams { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<GoldPurchase> GoldPurchases { get; set; } = [];
}

public class GoldPurchase
{
    public Guid Id { get; set; }
    public Guid ZakatProfileId { get; set; }
    public decimal Grams { get; set; }
    public decimal PricePerGram { get; set; }
    public decimal TotalCost { get; set; }
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public ZakatProfile ZakatProfile { get; set; } = default!;
}

// ═══ Finance Settings (إعدادات مالية) ═══

public class FinSettings
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public int DebtPercent { get; set; } = 10;
    public int SavingsPercent { get; set; } = 10;
    public string ExpenseCategoriesJson { get; set; } = "[]";
    public string IncomeCategoriesJson { get; set; } = "[]";
    public ApplicationUser Owner { get; set; } = default!;
}
