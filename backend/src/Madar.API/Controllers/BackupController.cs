using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/backup")]
public class BackupController : ControllerBase
{
    private readonly MadarDbContext _db;
    public BackupController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// <summary>Export all user data as JSON</summary>
    [HttpGet("export")]
    public async Task<IActionResult> ExportData(CancellationToken ct)
    {
        var tables = new[] {
            ("SmartTasks", "OwnerId"), ("Goals", "OwnerId"), ("Habits", "OwnerId"),
            ("LifeCircles", "OwnerId"), ("CircleGroups", "UserId"), ("UserCircles", "UserId"),
            ("Works", "OwnerId"), ("FinAccounts", "OwnerId"), ("FinTransactions", "OwnerId"),
            ("FinPockets", "OwnerId"), ("FinRecurringDues", "OwnerId"), ("FinDebts", "OwnerId"),
            ("Contacts", "OwnerId"), ("PrayerLogs", "OwnerId"), ("PrayerPenalties", "OwnerId"),
            ("DailyEnergyLogs", "UserId"), ("Dishes", "UserId"), ("Meals", "UserId"),
            ("Ingredients", "UserId"), ("BadHabits", "UserId"), ("TawbahRecords", "UserId"),
            ("LeadershipRoles", "UserId"), ("DevTickets", "UserId"), ("ReminderLogs", "UserId"),
        };

        var data = new Dictionary<string, object>();
        var totalRecords = 0;

        foreach (var (table, userCol) in tables)
        {
            try
            {
                var rows = await Q($"SELECT * FROM {table} WHERE {userCol}=@uid", Ps("@uid", Uid), ct);
                data[table] = rows;
                totalRecords += rows.Count;
            }
            catch { /* table might not exist */ }
        }

        data["_meta"] = new { exportDate = DateTime.UtcNow, userId = Uid, tablesExported = data.Count - 1, totalRecords };

        // Log the export
        try
        {
            var json = JsonSerializer.Serialize(data);
            await E("INSERT INTO BackupLogs (Id,UserId,BackupType,Status,FileSize,Notes) VALUES(@id,@uid,'manual','success',@fs,@n)",
                [P("@id", Guid.NewGuid().ToString()), P("@uid", Uid), P("@fs", Encoding.UTF8.GetByteCount(json)), P("@n", $"{data.Count - 1} tables, {totalRecords} records")], ct);
        }
        catch { }

        return Ok(data);
    }

    /// <summary>Get backup history</summary>
    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM BackupLogs WHERE UserId=@uid ORDER BY BackupDate DESC LIMIT 20", Ps("@uid", Uid), ct));

    // Helpers
    static MySqlParameter P(string n, object? v) => new(n, v ?? DBNull.Value);
    static List<MySqlParameter> Ps(string n, object? v) => [P(n, v)];
    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<MySqlParameter> ps, CancellationToken ct)
    { var c = _db.Database.GetDbConnection(); var w = c.State == System.Data.ConnectionState.Open; if (!w) await c.OpenAsync(ct);
      try { using var cmd = c.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
          using var r = await cmd.ExecuteReaderAsync(ct); var rows = new List<Dictionary<string, object?>>();
          while (await r.ReadAsync(ct)) { var row = new Dictionary<string, object?>(); for (int i = 0; i < r.FieldCount; i++) row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i); rows.Add(row); } return rows;
      } finally { if (!w) await c.CloseAsync(); } }
    private async Task<int> E(string sql, List<MySqlParameter> ps, CancellationToken ct)
    { var c = _db.Database.GetDbConnection(); var w = c.State == System.Data.ConnectionState.Open; if (!w) await c.OpenAsync(ct);
      try { using var cmd = c.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p); return await cmd.ExecuteNonQueryAsync(ct);
      } finally { if (!w) await c.CloseAsync(); } }
}
