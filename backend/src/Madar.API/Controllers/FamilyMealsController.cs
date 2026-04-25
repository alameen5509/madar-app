using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/family-meals")]
public class FamilyMealsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public FamilyMealsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ═══ FAMILY MEMBERS ══════════════════════════════════════════════

    [HttpGet("members")]
    public async Task<IActionResult> GetMembers(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM FamilyMembers WHERE UserId=@uid AND IsActive=1 ORDER BY Name", Ps("@uid",Uid), ct));

    [HttpPost("members")]
    public async Task<IActionResult> CreateMember([FromBody] MemberReq req, CancellationToken ct)
    {
        var id = NewId();
        await E("INSERT INTO FamilyMembers (Id,UserId,Name,Relationship,BirthDate,Gender,Notes) VALUES(@id,@uid,@n,@r,@bd,@g,@nt)",
            [P("@id",id),P("@uid",Uid),P("@n",req.Name),P("@r",req.Relationship),P("@bd",req.BirthDate),P("@g",req.Gender),P("@nt",req.Notes)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpPut("members/{id}")]
    public async Task<IActionResult> UpdateMember(string id, [FromBody] MemberReq req, CancellationToken ct)
    {
        var rows = await E("UPDATE FamilyMembers SET Name=COALESCE(@n,Name),Relationship=COALESCE(@r,Relationship),Gender=COALESCE(@g,Gender),Notes=COALESCE(@nt,Notes) WHERE Id=@id AND UserId=@uid",
            [P("@id",id),P("@uid",Uid),P("@n",req.Name),P("@r",req.Relationship),P("@g",req.Gender),P("@nt",req.Notes)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("members/{id}")]
    public async Task<IActionResult> DeleteMember(string id, CancellationToken ct)
    {
        await E("DELETE FROM PersonalMealPlans WHERE MemberId=@id", Ps("@id",id), ct);
        return (await E("DELETE FROM FamilyMembers WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    // ═══ PERSONAL MEAL PLANS ═════════════════════════════════════════

    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans([FromQuery] string? memberId, [FromQuery] string? date, CancellationToken ct)
    {
        var sql = @"SELECT p.*, fm.""Name"" as ""MemberName"", fm.""Relationship"",
            m.""Name"" as ""MealName"" FROM ""PersonalMealPlans"" p
            JOIN ""FamilyMembers"" fm ON p.""MemberId""=fm.""Id""
            LEFT JOIN ""Meals"" m ON p.""MealId""=m.""Id""
            WHERE p.""UserId""::text=@uid";
        var ps = new List<NpgsqlParameter> { P("@uid",Uid) };
        if (memberId != null) { sql += @" AND p.""MemberId""::text=@mid"; ps.Add(P("@mid",memberId)); }
        if (date != null) { sql += @" AND p.""PlanDate""=@d"; ps.Add(P("@d",date)); }
        sql += @" ORDER BY p.""PlanDate"", fm.""Name""";
        return Ok(await Q(sql, ps, ct));
    }

    [HttpGet("plans/daily")]
    public async Task<IActionResult> GetDailyGrid([FromQuery] string date, CancellationToken ct)
    {
        var members = await Q(@"SELECT ""Id"", ""Name"", ""Relationship"" FROM ""FamilyMembers"" WHERE ""UserId""::text=@uid AND ""IsActive""=true ORDER BY ""Name""", Ps("@uid",Uid), ct);
        var plans = await Q(@"SELECT p.*, m.""Name"" as ""MealName"" FROM ""PersonalMealPlans"" p
            LEFT JOIN ""Meals"" m ON p.""MealId""=m.""Id"" WHERE p.""UserId""::text=@uid AND p.""PlanDate""=@d",
            [P("@uid",Uid),P("@d",date)], ct);
        return Ok(new { members, plans, date });
    }

    [HttpPost("plans")]
    public async Task<IActionResult> CreatePlan([FromBody] PlanReq2 req, CancellationToken ct)
    {
        var id = NewId();
        // Upsert: if exists for same member+date+mealTime, update
        await E(@"INSERT INTO ""PersonalMealPlans"" (""Id"",""UserId"",""MemberId"",""PlanDate"",""MealTime"",""MealId"",""CustomDesc"",""Notes"") VALUES(@id,@uid,@mid,@d,@mt,@mlid,@cd,@nt)
            ON CONFLICT (""MemberId"",""PlanDate"",""MealTime"") DO UPDATE SET ""MealId""=EXCLUDED.""MealId"",""CustomDesc""=EXCLUDED.""CustomDesc"",""Notes""=EXCLUDED.""Notes""",
            [P("@id",id),P("@uid",Uid),P("@mid",req.MemberId),P("@d",req.Date),P("@mt",req.MealTime),P("@mlid",req.MealId),P("@cd",req.CustomDesc),P("@nt",req.Notes)], ct);
        return Ok(new { id });
    }

    [HttpDelete("plans/{id}")]
    public async Task<IActionResult> DeletePlan(string id, CancellationToken ct) =>
        (await E("DELETE FROM PersonalMealPlans WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();

    // Helpers
    static string NewId() => Guid.NewGuid().ToString();
    static NpgsqlParameter P(string n, object? v) =>
        v is string s && Guid.TryParse(s, out var g)
            ? new NpgsqlParameter(n, NpgsqlTypes.NpgsqlDbType.Uuid) { Value = g }
            : new(n, v ?? DBNull.Value);
    static List<NpgsqlParameter> Ps(string n, object? v) => [P(n, v)];
    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    { var c=_db.Database.GetDbConnection();var w=c.State==System.Data.ConnectionState.Open;if(!w)await c.OpenAsync(ct);
      try{using var cmd=c.CreateCommand();cmd.CommandText=sql;foreach(var p in ps)cmd.Parameters.Add(p);using var r=await cmd.ExecuteReaderAsync(ct);var rows=new List<Dictionary<string,object?>>();
        while(await r.ReadAsync(ct)){var row=new Dictionary<string,object?>();for(int i=0;i<r.FieldCount;i++)row[char.ToLowerInvariant(r.GetName(i)[0])+r.GetName(i)[1..]]=r.IsDBNull(i)?null:r.GetValue(i);rows.Add(row);}return rows;
      }finally{if(!w)await c.CloseAsync();}}
    private async Task<int> E(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    { var c=_db.Database.GetDbConnection();var w=c.State==System.Data.ConnectionState.Open;if(!w)await c.OpenAsync(ct);
      try{using var cmd=c.CreateCommand();cmd.CommandText=sql;foreach(var p in ps)cmd.Parameters.Add(p);return await cmd.ExecuteNonQueryAsync(ct);
      }finally{if(!w)await c.CloseAsync();}}
}

public class MemberReq { public string? Name{get;set;} public string? Relationship{get;set;} public DateTime? BirthDate{get;set;} public string? Gender{get;set;} public string? Notes{get;set;} }
public class PlanReq2 { public string? MemberId{get;set;} public string? Date{get;set;} public string? MealTime{get;set;} public string? MealId{get;set;} public string? CustomDesc{get;set;} public string? Notes{get;set;} }
