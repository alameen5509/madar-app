namespace Madar.Domain.Enums;

public enum CircleTier { Base = 0, First = 1, Second = 2, Business = 3, Third = 4, Fourth = 5, Fifth = 6 }
public enum GoalStatus { Active, Paused, Completed, Archived, Draft, Critical }
public enum TaskStatus { Inbox, Todo, Scheduled, InProgress, Completed, Deferred, Cancelled }
public enum TaskType { Action, Project, Event, Habit, Reference }
public enum TaskContext { Anywhere, Home, Office, Car, Online, Phone }
public enum CognitiveLoad { Low, Medium, High, Deep }
public enum SalahBlock { PreFajr, PostFajr, Duha, PostDhuhr, PostAsr, PostMaghrib, PostIsha, Overnight }
public enum CalculationMethod { UmmAlQura, MuslimWorldLeague, Egyptian, Karachi, NorthAmerica, Tehran, Shia }
public enum Chronotype { EarlyBird, Intermediate, NightOwl }
public enum ContractStatus { Draft, Active, PendingRenewal, Expired, Cancelled }
public enum PermissionKey
{
    Tasks_View, Tasks_Create, Tasks_Edit, Tasks_Delete, Tasks_Reassign,
    Goals_View, Goals_Create, Goals_Edit,
    Circles_View, Circles_Manage,
    Ai_ViewSuggestions, Ai_ApproveSchedule, Ai_OverridePriority,
    Members_Invite, Members_Remove, Roles_Manage,
    Reports_View, Reports_Export
}
