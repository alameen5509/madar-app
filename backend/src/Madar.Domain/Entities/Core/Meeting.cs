using Madar.Domain.Entities.Identity;
using Madar.Domain.Enums;

namespace Madar.Domain.Entities.Core;

public class Meeting
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }

    public MeetingType MeetingType { get; set; } = MeetingType.Remote;
    public string? Platform { get; set; }
    public string? Location { get; set; }
    public string? MeetingLink { get; set; }

    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    public MeetingStatus Status { get; set; } = MeetingStatus.Scheduled;
    public MeetingRecurrence Recurrence { get; set; } = MeetingRecurrence.None;

    // Relations
    public Guid? ProjectId { get; set; }
    public Guid? WorkId { get; set; }
    public Guid? CircleId { get; set; }

    public string? Notes { get; set; }
    public bool IsPrivate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ApplicationUser Owner { get; set; } = default!;
    public Project? Project { get; set; }
    public Work? Work { get; set; }
    public LifeCircle? Circle { get; set; }
    public ICollection<MeetingAttendee> Attendees { get; set; } = [];
    public ICollection<MeetingAgendaItem> Agenda { get; set; } = [];
    public ICollection<MeetingMinute> Minutes { get; set; } = [];
    public ICollection<MeetingActionItem> ActionItems { get; set; } = [];
}

public class MeetingAttendee
{
    public Guid Id { get; set; }
    public Guid MeetingId { get; set; }
    public string Name { get; set; } = default!;
    public AttendeeRole Role { get; set; } = AttendeeRole.Attendee;
    public AttendeeStatus Status { get; set; } = AttendeeStatus.Invited;
    public string? Notes { get; set; }
    public Guid? ContactId { get; set; }

    public Meeting Meeting { get; set; } = default!;
    public Contact? Contact { get; set; }
}

public class MeetingAgendaItem
{
    public Guid Id { get; set; }
    public Guid MeetingId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public int Duration { get; set; } = 10; // minutes
    public int DisplayOrder { get; set; }
    public bool IsCompleted { get; set; }

    public Meeting Meeting { get; set; } = default!;
}

public class MeetingMinute
{
    public Guid Id { get; set; }
    public Guid MeetingId { get; set; }
    public string Content { get; set; } = default!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Meeting Meeting { get; set; } = default!;
}

public class MeetingActionItem
{
    public Guid Id { get; set; }
    public Guid MeetingId { get; set; }
    public string Title { get; set; } = default!;
    public string? AssignedTo { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsCompleted { get; set; }
    public Guid? TaskId { get; set; }

    public Meeting Meeting { get; set; } = default!;
    public SmartTask? Task { get; set; }
}
