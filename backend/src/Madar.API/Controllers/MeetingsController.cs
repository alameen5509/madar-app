using System.Security.Claims;
using Madar.Domain.Entities.Core;
using Madar.Domain.Enums;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/meetings")]
public class MeetingsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public MeetingsController(MadarDbContext db) => _db = db;
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? date, CancellationToken ct)
    {
        var q = _db.Meetings
            .Where(m => m.OwnerId == Uid)
            .Include(m => m.Attendees)
            .AsQueryable();

        if (status != null && Enum.TryParse<MeetingStatus>(status, true, out var s))
            q = q.Where(m => m.Status == s);
        if (date != null && DateTime.TryParse(date, out var d))
            q = q.Where(m => m.StartTime.Date == d.Date);

        var meetings = await q
            .OrderByDescending(m => m.StartTime)
            .Select(m => new
            {
                m.Id, m.Title, m.Description,
                meetingType = m.MeetingType.ToString().ToLower(),
                m.Platform, m.Location, m.MeetingLink,
                m.StartTime, m.EndTime,
                status = m.Status.ToString().ToLower(),
                m.WorkId, m.ProjectId, m.CircleId,
                recurrence = m.Recurrence.ToString().ToLower(),
                m.Notes, m.IsPrivate, m.CreatedAt,
                attendeeCount = m.Attendees.Count,
            })
            .ToListAsync(ct);

        return Ok(meetings);
    }

    [HttpGet("today")]
    public async Task<IActionResult> GetToday(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var meetings = await _db.Meetings
            .Where(m => m.OwnerId == Uid && m.StartTime.Date == today)
            .OrderBy(m => m.StartTime)
            .Select(m => new
            {
                m.Id, m.Title, m.Description,
                meetingType = m.MeetingType.ToString().ToLower(),
                m.Platform, m.Location, m.MeetingLink,
                m.StartTime, m.EndTime,
                status = m.Status.ToString().ToLower(),
                m.Notes, m.IsPrivate,
                attendeeCount = m.Attendees.Count,
            })
            .ToListAsync(ct);
        return Ok(meetings);
    }

    [HttpGet("upcoming")]
    public async Task<IActionResult> GetUpcoming(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var meetings = await _db.Meetings
            .Where(m => m.OwnerId == Uid && m.StartTime >= now && m.Status == MeetingStatus.Scheduled)
            .OrderBy(m => m.StartTime)
            .Take(20)
            .Select(m => new
            {
                m.Id, m.Title, m.Description,
                meetingType = m.MeetingType.ToString().ToLower(),
                m.Platform, m.Location, m.MeetingLink,
                m.StartTime, m.EndTime,
                status = m.Status.ToString().ToLower(),
                m.WorkId, m.ProjectId, m.Notes,
                attendeeCount = m.Attendees.Count,
            })
            .ToListAsync(ct);
        return Ok(meetings);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOne(Guid id, CancellationToken ct)
    {
        var m = await _db.Meetings
            .Include(x => x.Attendees)
            .Include(x => x.Agenda.OrderBy(a => a.DisplayOrder))
            .Include(x => x.Minutes.OrderByDescending(mn => mn.CreatedAt))
            .Include(x => x.ActionItems)
            .Include(x => x.Project)
            .Include(x => x.Work)
            .Include(x => x.Circle)
            .FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == Uid, ct);

        if (m is null) return NotFound();

        return Ok(new
        {
            m.Id, m.Title, m.Description,
            meetingType = m.MeetingType.ToString().ToLower(),
            m.Platform, m.Location, m.MeetingLink,
            m.StartTime, m.EndTime,
            status = m.Status.ToString().ToLower(),
            recurrence = m.Recurrence.ToString().ToLower(),
            m.Notes, m.IsPrivate, m.CreatedAt, m.UpdatedAt,
            m.ProjectId, m.WorkId, m.CircleId,
            project = m.Project != null ? new { m.Project.Id, m.Project.Title } : null,
            work = m.Work != null ? new { m.Work.Id, m.Work.Name } : null,
            circle = m.Circle != null ? new { m.Circle.Id, m.Circle.Name } : null,
            attendees = m.Attendees.Select(a => new
            {
                a.Id, a.Name,
                role = a.Role.ToString().ToLower(),
                status = a.Status.ToString().ToLower(),
                a.Notes, a.ContactId,
            }),
            agenda = m.Agenda.Select(a => new
            {
                a.Id, a.Title, a.Description, a.Duration, a.DisplayOrder, a.IsCompleted,
            }),
            minutes = m.Minutes.Select(mn => new
            {
                mn.Id, mn.Content, mn.CreatedAt,
            }),
            actionItems = m.ActionItems.Select(ai => new
            {
                ai.Id, ai.Title, ai.AssignedTo, ai.DueDate, ai.IsCompleted, ai.TaskId,
            }),
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MeetingReq req, CancellationToken ct)
    {
        var meeting = new Meeting
        {
            Id = Guid.NewGuid(),
            OwnerId = Uid,
            Title = req.Title ?? "",
            Description = req.Description,
            MeetingType = Enum.TryParse<MeetingType>(req.MeetingType, true, out var mt) ? mt : MeetingType.Remote,
            Platform = req.Platform,
            Location = req.Location,
            MeetingLink = req.MeetingLink,
            StartTime = req.StartTime ?? DateTime.UtcNow,
            EndTime = req.EndTime,
            Status = MeetingStatus.Scheduled,
            Recurrence = Enum.TryParse<MeetingRecurrence>(req.Recurrence, true, out var rec) ? rec : MeetingRecurrence.None,
            WorkId = req.WorkId,
            ProjectId = req.ProjectId,
            CircleId = req.CircleId,
            Notes = req.Notes,
            IsPrivate = req.IsPrivate ?? false,
        };

        if (req.Attendees != null)
            foreach (var a in req.Attendees)
                meeting.Attendees.Add(new MeetingAttendee
                {
                    Id = Guid.NewGuid(),
                    Name = a.Name ?? "",
                    Role = Enum.TryParse<AttendeeRole>(a.Role, true, out var ar) ? ar : AttendeeRole.Attendee,
                    Notes = a.Notes,
                });

        if (req.Agenda != null)
            for (int i = 0; i < req.Agenda.Count; i++)
                meeting.Agenda.Add(new MeetingAgendaItem
                {
                    Id = Guid.NewGuid(),
                    Title = req.Agenda[i].Title ?? "",
                    Description = req.Agenda[i].Description,
                    Duration = req.Agenda[i].Duration ?? 10,
                    DisplayOrder = i,
                });

        _db.Meetings.Add(meeting);
        await _db.SaveChangesAsync(ct);
        return Ok(new { meeting.Id, meeting.Title });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MeetingReq req, CancellationToken ct)
    {
        var meeting = await _db.Meetings.FirstOrDefaultAsync(m => m.Id == id && m.OwnerId == Uid, ct);
        if (meeting is null) return NotFound();

        if (req.Title != null) meeting.Title = req.Title;
        if (req.Description != null) meeting.Description = req.Description;
        if (req.MeetingType != null && Enum.TryParse<MeetingType>(req.MeetingType, true, out var mt)) meeting.MeetingType = mt;
        if (req.Platform != null) meeting.Platform = req.Platform;
        if (req.Location != null) meeting.Location = req.Location;
        if (req.MeetingLink != null) meeting.MeetingLink = req.MeetingLink;
        if (req.StartTime.HasValue) meeting.StartTime = req.StartTime.Value;
        if (req.EndTime.HasValue) meeting.EndTime = req.EndTime.Value;
        if (req.Status != null && Enum.TryParse<MeetingStatus>(req.Status, true, out var s)) meeting.Status = s;
        if (req.Notes != null) meeting.Notes = req.Notes;
        if (req.IsPrivate.HasValue) meeting.IsPrivate = req.IsPrivate.Value;
        if (req.ProjectId.HasValue) meeting.ProjectId = req.ProjectId;
        if (req.WorkId.HasValue) meeting.WorkId = req.WorkId;
        if (req.CircleId.HasValue) meeting.CircleId = req.CircleId;
        meeting.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم التحديث" });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var meeting = await _db.Meetings.FirstOrDefaultAsync(m => m.Id == id && m.OwnerId == Uid, ct);
        if (meeting is null) return NotFound();
        _db.Meetings.Remove(meeting);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم الحذف" });
    }

    // ═══ Complete / Cancel ═══

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var m = await _db.Meetings.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == Uid, ct);
        if (m is null) return NotFound();
        m.Status = MeetingStatus.Completed;
        m.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { m.Id });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var m = await _db.Meetings.FirstOrDefaultAsync(x => x.Id == id && x.OwnerId == Uid, ct);
        if (m is null) return NotFound();
        m.Status = MeetingStatus.Cancelled;
        m.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { m.Id });
    }

    // ═══ Attendees ═══

    [HttpPost("{meetingId:guid}/attendees")]
    public async Task<IActionResult> AddAttendee(Guid meetingId, [FromBody] AttendeeReq req, CancellationToken ct)
    {
        var exists = await _db.Meetings.AnyAsync(m => m.Id == meetingId && m.OwnerId == Uid, ct);
        if (!exists) return NotFound();
        var attendee = new MeetingAttendee
        {
            Id = Guid.NewGuid(),
            MeetingId = meetingId,
            Name = req.Name ?? "",
            Role = Enum.TryParse<AttendeeRole>(req.Role, true, out var ar) ? ar : AttendeeRole.Attendee,
            Notes = req.Notes,
        };
        _db.MeetingAttendees.Add(attendee);
        await _db.SaveChangesAsync(ct);
        return Ok(new { attendee.Id, attendee.Name, role = attendee.Role.ToString().ToLower() });
    }

    [HttpPatch("attendees/{id:guid}")]
    public async Task<IActionResult> UpdateAttendee(Guid id, [FromBody] AttendeeReq req, CancellationToken ct)
    {
        var a = await _db.MeetingAttendees.Include(x => x.Meeting)
            .FirstOrDefaultAsync(x => x.Id == id && x.Meeting.OwnerId == Uid, ct);
        if (a is null) return NotFound();
        if (req.Name != null) a.Name = req.Name;
        if (req.Role != null && Enum.TryParse<AttendeeRole>(req.Role, true, out var ar)) a.Role = ar;
        if (req.Status != null && Enum.TryParse<AttendeeStatus>(req.Status, true, out var s)) a.Status = s;
        if (req.Notes != null) a.Notes = req.Notes;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم التحديث" });
    }

    [HttpDelete("attendees/{id:guid}")]
    public async Task<IActionResult> RemoveAttendee(Guid id, CancellationToken ct)
    {
        var a = await _db.MeetingAttendees.Include(x => x.Meeting)
            .FirstOrDefaultAsync(x => x.Id == id && x.Meeting.OwnerId == Uid, ct);
        if (a is null) return NotFound();
        _db.MeetingAttendees.Remove(a);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ═══ Agenda ═══

    [HttpPost("{meetingId:guid}/agenda")]
    public async Task<IActionResult> AddAgendaItem(Guid meetingId, [FromBody] AgendaReq req, CancellationToken ct)
    {
        var exists = await _db.Meetings.AnyAsync(m => m.Id == meetingId && m.OwnerId == Uid, ct);
        if (!exists) return NotFound();
        var maxOrder = await _db.MeetingAgenda.Where(a => a.MeetingId == meetingId).MaxAsync(a => (int?)a.DisplayOrder, ct) ?? -1;
        var item = new MeetingAgendaItem
        {
            Id = Guid.NewGuid(),
            MeetingId = meetingId,
            Title = req.Title ?? "",
            Description = req.Description,
            Duration = req.Duration ?? 10,
            DisplayOrder = maxOrder + 1,
        };
        _db.MeetingAgenda.Add(item);
        await _db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Title, item.Duration, item.DisplayOrder });
    }

    [HttpPatch("agenda/{id:guid}")]
    public async Task<IActionResult> UpdateAgendaItem(Guid id, [FromBody] AgendaReq req, CancellationToken ct)
    {
        var item = await _db.MeetingAgenda.Include(x => x.Meeting)
            .FirstOrDefaultAsync(x => x.Id == id && x.Meeting.OwnerId == Uid, ct);
        if (item is null) return NotFound();
        if (req.Title != null) item.Title = req.Title;
        if (req.Description != null) item.Description = req.Description;
        if (req.Duration.HasValue) item.Duration = req.Duration.Value;
        if (req.IsCompleted.HasValue) item.IsCompleted = req.IsCompleted.Value;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم التحديث" });
    }

    [HttpDelete("agenda/{id:guid}")]
    public async Task<IActionResult> RemoveAgendaItem(Guid id, CancellationToken ct)
    {
        var item = await _db.MeetingAgenda.Include(x => x.Meeting)
            .FirstOrDefaultAsync(x => x.Id == id && x.Meeting.OwnerId == Uid, ct);
        if (item is null) return NotFound();
        _db.MeetingAgenda.Remove(item);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ═══ Minutes ═══

    [HttpPost("{meetingId:guid}/minutes")]
    public async Task<IActionResult> AddMinute(Guid meetingId, [FromBody] MinuteReq req, CancellationToken ct)
    {
        var exists = await _db.Meetings.AnyAsync(m => m.Id == meetingId && m.OwnerId == Uid, ct);
        if (!exists) return NotFound();
        var minute = new MeetingMinute
        {
            Id = Guid.NewGuid(),
            MeetingId = meetingId,
            Content = req.Content ?? "",
        };
        _db.MeetingMinutes.Add(minute);
        await _db.SaveChangesAsync(ct);
        return Ok(new { minute.Id, minute.Content, minute.CreatedAt });
    }

    [HttpDelete("minutes/{id:guid}")]
    public async Task<IActionResult> RemoveMinute(Guid id, CancellationToken ct)
    {
        var mn = await _db.MeetingMinutes.Include(x => x.Meeting)
            .FirstOrDefaultAsync(x => x.Id == id && x.Meeting.OwnerId == Uid, ct);
        if (mn is null) return NotFound();
        _db.MeetingMinutes.Remove(mn);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ═══ Action Items ═══

    [HttpPost("{meetingId:guid}/actions")]
    public async Task<IActionResult> AddActionItem(Guid meetingId, [FromBody] ActionItemReq req, CancellationToken ct)
    {
        var exists = await _db.Meetings.AnyAsync(m => m.Id == meetingId && m.OwnerId == Uid, ct);
        if (!exists) return NotFound();
        var item = new MeetingActionItem
        {
            Id = Guid.NewGuid(),
            MeetingId = meetingId,
            Title = req.Title ?? "",
            AssignedTo = req.AssignedTo,
            DueDate = req.DueDate,
        };
        _db.MeetingActionItems.Add(item);
        await _db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Title, item.AssignedTo, item.DueDate });
    }

    [HttpPatch("actions/{id:guid}")]
    public async Task<IActionResult> UpdateActionItem(Guid id, [FromBody] ActionItemReq req, CancellationToken ct)
    {
        var item = await _db.MeetingActionItems.Include(x => x.Meeting)
            .FirstOrDefaultAsync(x => x.Id == id && x.Meeting.OwnerId == Uid, ct);
        if (item is null) return NotFound();
        if (req.Title != null) item.Title = req.Title;
        if (req.AssignedTo != null) item.AssignedTo = req.AssignedTo;
        if (req.DueDate.HasValue) item.DueDate = req.DueDate;
        if (req.IsCompleted.HasValue) item.IsCompleted = req.IsCompleted.Value;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "تم التحديث" });
    }

    [HttpDelete("actions/{id:guid}")]
    public async Task<IActionResult> RemoveActionItem(Guid id, CancellationToken ct)
    {
        var item = await _db.MeetingActionItems.Include(x => x.Meeting)
            .FirstOrDefaultAsync(x => x.Id == id && x.Meeting.OwnerId == Uid, ct);
        if (item is null) return NotFound();
        _db.MeetingActionItems.Remove(item);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public class MeetingReq
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? MeetingType { get; set; }
    public string? Platform { get; set; }
    public string? Location { get; set; }
    public string? MeetingLink { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string? Status { get; set; }
    public Guid? WorkId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? CircleId { get; set; }
    public string? Recurrence { get; set; }
    public string? Notes { get; set; }
    public bool? IsPrivate { get; set; }
    public List<AttendeeReq>? Attendees { get; set; }
    public List<AgendaReq>? Agenda { get; set; }
}

public class AttendeeReq
{
    public string? Name { get; set; }
    public string? Role { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public class AgendaReq
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public int? Duration { get; set; }
    public bool? IsCompleted { get; set; }
}

public class MinuteReq { public string? Content { get; set; } }

public class ActionItemReq
{
    public string? Title { get; set; }
    public string? AssignedTo { get; set; }
    public DateTime? DueDate { get; set; }
    public bool? IsCompleted { get; set; }
}
