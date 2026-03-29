using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/meetings")]
public class MeetingsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public MeetingsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? date, CancellationToken ct)
    {
        var sql = "SELECT * FROM Meetings WHERE UserId=@uid";
        var ps = new List<MySqlParameter> { P("@uid", Uid) };
        if (status != null) { sql += " AND Status=@s"; ps.Add(P("@s", status)); }
        if (date != null) { sql += " AND DATE(StartTime)=@d"; ps.Add(P("@d", date)); }
        sql += " ORDER BY StartTime DESC";
        return Ok(await Q(sql, ps, ct));
    }

    [HttpGet("today")]
    public async Task<IActionResult> GetToday(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM Meetings WHERE UserId=@uid AND DATE(StartTime)=CURDATE() ORDER BY StartTime", Ps("@uid", Uid), ct));

    [HttpGet("upcoming")]
    public async Task<IActionResult> GetUpcoming(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM Meetings WHERE UserId=@uid AND StartTime>=NOW() AND Status='scheduled' ORDER BY StartTime LIMIT 20", Ps("@uid", Uid), ct));

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(string id, CancellationToken ct)
    {
        var rows = await Q("SELECT * FROM Meetings WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct);
        if (rows.Count == 0) return NotFound();
        rows[0]["attendees"] = await Q("SELECT * FROM MeetingAttendees WHERE MeetingId=@mid ORDER BY Role", Ps("@mid",id), ct);
        rows[0]["agenda"] = await Q("SELECT * FROM MeetingAgenda WHERE MeetingId=@mid ORDER BY DisplayOrder", Ps("@mid",id), ct);
        rows[0]["minutes"] = await Q("SELECT * FROM MeetingMinutes WHERE MeetingId=@mid ORDER BY CreatedAt DESC", Ps("@mid",id), ct);
        return Ok(rows[0]);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MeetingReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO Meetings (Id,UserId,Title,Description,MeetingType,Platform,Location,MeetingLink,StartTime,EndTime,Status,WorkId,ProjectId,Recurrence,Notes)
            VALUES(@id,@uid,@t,@d,@mt,@pl,@loc,@link,@st,@et,'scheduled',@wid,@pid,@rec,@n)",
            [P("@id",id),P("@uid",Uid),P("@t",req.Title),P("@d",req.Description),P("@mt",req.MeetingType??"remote"),
             P("@pl",req.Platform),P("@loc",req.Location),P("@link",req.MeetingLink),
             P("@st",req.StartTime),P("@et",req.EndTime),P("@wid",req.WorkId),P("@pid",req.ProjectId),
             P("@rec",req.Recurrence??"none"),P("@n",req.Notes)], ct);
        // Add attendees
        if (req.Attendees != null)
            foreach (var a in req.Attendees)
                await E("INSERT INTO MeetingAttendees (Id,MeetingId,Name,Role) VALUES(@id,@mid,@n,@r)",
                    [P("@id",Guid.NewGuid().ToString()),P("@mid",id),P("@n",a.Name??""),P("@r",a.Role??"attendee")], ct);
        // Add agenda
        if (req.Agenda != null)
            for (int i = 0; i < req.Agenda.Count; i++)
                await E("INSERT INTO MeetingAgenda (Id,MeetingId,Title,Duration,DisplayOrder) VALUES(@id,@mid,@t,@dur,@ord)",
                    [P("@id",Guid.NewGuid().ToString()),P("@mid",id),P("@t",req.Agenda[i].Title??""),P("@dur",req.Agenda[i].Duration??10),P("@ord",i)], ct);
        return Ok(new { id, title = req.Title });
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] MeetingReq req, CancellationToken ct)
    {
        var sets = new List<string>();
        var ps = new List<MySqlParameter> { P("@id",id), P("@uid",Uid) };
        if (req.Title != null) { sets.Add("Title=@t"); ps.Add(P("@t",req.Title)); }
        if (req.Description != null) { sets.Add("Description=@d"); ps.Add(P("@d",req.Description)); }
        if (req.StartTime.HasValue) { sets.Add("StartTime=@st"); ps.Add(P("@st",req.StartTime)); }
        if (req.EndTime.HasValue) { sets.Add("EndTime=@et"); ps.Add(P("@et",req.EndTime)); }
        if (req.Status != null) { sets.Add("Status=@s"); ps.Add(P("@s",req.Status)); }
        if (req.Location != null) { sets.Add("Location=@loc"); ps.Add(P("@loc",req.Location)); }
        if (req.MeetingLink != null) { sets.Add("MeetingLink=@link"); ps.Add(P("@link",req.MeetingLink)); }
        if (req.Notes != null) { sets.Add("Notes=@n"); ps.Add(P("@n",req.Notes)); }
        if (sets.Count == 0) return Ok(new { id });
        return (await E($"UPDATE Meetings SET {string.Join(",",sets)} WHERE Id=@id AND UserId=@uid", ps, ct)) > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        await E("DELETE FROM MeetingAttendees WHERE MeetingId=@id", Ps("@id",id), ct);
        await E("DELETE FROM MeetingAgenda WHERE MeetingId=@id", Ps("@id",id), ct);
        await E("DELETE FROM MeetingMinutes WHERE MeetingId=@id", Ps("@id",id), ct);
        return (await E("DELETE FROM Meetings WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    // Attendees
    [HttpPost("{meetingId}/attendees")]
    public async Task<IActionResult> AddAttendee(string meetingId, [FromBody] AttendeeReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E("INSERT INTO MeetingAttendees (Id,MeetingId,Name,Role,Notes) VALUES(@id,@mid,@n,@r,@nt)",
            [P("@id",id),P("@mid",meetingId),P("@n",req.Name),P("@r",req.Role??"attendee"),P("@nt",req.Notes)], ct);
        return Ok(new { id });
    }

    [HttpDelete("attendees/{id}")]
    public async Task<IActionResult> RemoveAttendee(string id, CancellationToken ct) =>
        (await E("DELETE FROM MeetingAttendees WHERE Id=@id", Ps("@id",id), ct)) > 0 ? NoContent() : NotFound();

    // Minutes
    [HttpPost("{meetingId}/minutes")]
    public async Task<IActionResult> AddMinutes(string meetingId, [FromBody] MinuteReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E("INSERT INTO MeetingMinutes (Id,MeetingId,Content) VALUES(@id,@mid,@c)",
            [P("@id",id),P("@mid",meetingId),P("@c",req.Content)], ct);
        return Ok(new { id });
    }

    // Complete meeting
    [HttpPost("{id}/complete")]
    public async Task<IActionResult> Complete(string id, CancellationToken ct) =>
        (await E("UPDATE Meetings SET Status='completed' WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? Ok(new { id }) : NotFound();

    // Helpers
    static MySqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);
    static List<MySqlParameter> Ps(string n, object? v) => [P(n, v)];
    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<MySqlParameter> ps, CancellationToken ct)
    { var c=_db.Database.GetDbConnection();var w=c.State==System.Data.ConnectionState.Open;if(!w)await c.OpenAsync(ct);
      try{using var cmd=c.CreateCommand();cmd.CommandText=sql;foreach(var p in ps)cmd.Parameters.Add(p);using var r=await cmd.ExecuteReaderAsync(ct);var rows=new List<Dictionary<string,object?>>();
        while(await r.ReadAsync(ct)){var row=new Dictionary<string,object?>();for(int i=0;i<r.FieldCount;i++)row[char.ToLowerInvariant(r.GetName(i)[0])+r.GetName(i)[1..]]=r.IsDBNull(i)?null:r.GetValue(i);rows.Add(row);}return rows;
      }finally{if(!w)await c.CloseAsync();}}
    private async Task<int> E(string sql, List<MySqlParameter> ps, CancellationToken ct)
    { var c=_db.Database.GetDbConnection();var w=c.State==System.Data.ConnectionState.Open;if(!w)await c.OpenAsync(ct);
      try{using var cmd=c.CreateCommand();cmd.CommandText=sql;foreach(var p in ps)cmd.Parameters.Add(p);return await cmd.ExecuteNonQueryAsync(ct);
      }finally{if(!w)await c.CloseAsync();}}
}

public class MeetingReq { public string? Title{get;set;} public string? Description{get;set;} public string? MeetingType{get;set;} public string? Platform{get;set;} public string? Location{get;set;} public string? MeetingLink{get;set;} public DateTime? StartTime{get;set;} public DateTime? EndTime{get;set;} public string? Status{get;set;} public string? WorkId{get;set;} public string? ProjectId{get;set;} public string? Recurrence{get;set;} public string? Notes{get;set;} public List<AttendeeReq>? Attendees{get;set;} public List<AgendaReq>? Agenda{get;set;} }
public class AttendeeReq { public string? Name{get;set;} public string? Role{get;set;} public string? Notes{get;set;} }
public class AgendaReq { public string? Title{get;set;} public int? Duration{get;set;} }
public class MinuteReq { public string? Content{get;set;} }
