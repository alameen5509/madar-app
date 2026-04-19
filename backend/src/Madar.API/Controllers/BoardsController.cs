using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/boards")]
public class BoardsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public BoardsController(MadarDbContext db) => _db = db;
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>GET /api/boards?entityType=job&amp;entityId=xxx</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? entityType,
        [FromQuery] Guid? entityId,
        CancellationToken ct)
    {
        var q = _db.Database.GetDbConnection();
        // Use raw SQL since Boards is not in EF model
        var sql = "SELECT Id, Name, EntityType, EntityId, Data, CreatedAt, UpdatedAt FROM Boards WHERE UserId = @uid";
        var parameters = new List<NpgsqlParameter>
        {
            new("@uid", UserId.ToString()),
        };

        if (!string.IsNullOrEmpty(entityType))
        {
            sql += " AND EntityType = @et";
            parameters.Add(new("@et", entityType));
        }
        if (entityId.HasValue)
        {
            sql += " AND EntityId = @eid";
            parameters.Add(new("@eid", entityId.Value.ToString()));
        }
        sql += " ORDER BY UpdatedAt DESC";

        var boards = new List<object>();
        await q.OpenAsync(ct);
        try
        {
            using var cmd = q.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in parameters)
                cmd.Parameters.Add(p);

            using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                boards.Add(new
                {
                    id = reader.GetString(0),
                    name = reader.GetString(1),
                    entityType = reader.GetString(2),
                    entityId = reader.IsDBNull(3) ? null : reader.GetString(3),
                    data = reader.IsDBNull(4) ? null : reader.GetString(4),
                    createdAt = reader.GetDateTime(5),
                    updatedAt = reader.GetDateTime(6),
                });
            }
        }
        finally { await q.CloseAsync(); }

        return Ok(boards);
    }

    /// <summary>GET /api/boards/:id</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var q = _db.Database.GetDbConnection();
        await q.OpenAsync(ct);
        try
        {
            using var cmd = q.CreateCommand();
            cmd.CommandText = "SELECT Id, Name, EntityType, EntityId, Data, CreatedAt, UpdatedAt FROM Boards WHERE Id = @id AND UserId = @uid";
            cmd.Parameters.Add(new NpgsqlParameter("@id", id.ToString()));
            cmd.Parameters.Add(new NpgsqlParameter("@uid", UserId.ToString()));

            using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return NotFound();

            return Ok(new
            {
                id = reader.GetString(0),
                name = reader.GetString(1),
                entityType = reader.GetString(2),
                entityId = reader.IsDBNull(3) ? null : reader.GetString(3),
                data = reader.IsDBNull(4) ? null : reader.GetString(4),
                createdAt = reader.GetDateTime(5),
                updatedAt = reader.GetDateTime(6),
            });
        }
        finally { await q.CloseAsync(); }
    }

    /// <summary>POST /api/boards</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBoardReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var q = _db.Database.GetDbConnection();
        await q.OpenAsync(ct);
        try
        {
            using var cmd = q.CreateCommand();
            cmd.CommandText = @"INSERT INTO Boards (Id, UserId, Name, EntityType, EntityId, Data, CreatedAt, UpdatedAt)
                                VALUES (@id, @uid, @name, @et, @eid, @data, @now, @now)";
            cmd.Parameters.Add(new NpgsqlParameter("@id", id.ToString()));
            cmd.Parameters.Add(new NpgsqlParameter("@uid", UserId.ToString()));
            cmd.Parameters.Add(new NpgsqlParameter("@name", req.Name ?? "سبورة جديدة"));
            cmd.Parameters.Add(new NpgsqlParameter("@et", req.EntityType ?? "personal"));
            cmd.Parameters.Add(new NpgsqlParameter("@eid", req.EntityId ?? (object)DBNull.Value));
            cmd.Parameters.Add(new NpgsqlParameter("@data", req.Data ?? (object)DBNull.Value));
            cmd.Parameters.Add(new NpgsqlParameter("@now", now));
            await cmd.ExecuteNonQueryAsync(ct);
        }
        finally { await q.CloseAsync(); }

        return Ok(new { id = id.ToString(), name = req.Name, entityType = req.EntityType, entityId = req.EntityId, createdAt = now });
    }

    /// <summary>PUT /api/boards/:id</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBoardReq req, CancellationToken ct)
    {
        var q = _db.Database.GetDbConnection();
        await q.OpenAsync(ct);
        try
        {
            using var cmd = q.CreateCommand();
            cmd.CommandText = @"UPDATE Boards SET Data = @data, Name = COALESCE(@name, Name), UpdatedAt = @now
                                WHERE Id = @id AND UserId = @uid";
            cmd.Parameters.Add(new NpgsqlParameter("@data", req.Data ?? (object)DBNull.Value));
            cmd.Parameters.Add(new NpgsqlParameter("@name", req.Name ?? (object)DBNull.Value));
            cmd.Parameters.Add(new NpgsqlParameter("@now", DateTime.UtcNow));
            cmd.Parameters.Add(new NpgsqlParameter("@id", id.ToString()));
            cmd.Parameters.Add(new NpgsqlParameter("@uid", UserId.ToString()));
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            if (rows == 0) return NotFound();
        }
        finally { await q.CloseAsync(); }

        return Ok(new { id = id.ToString() });
    }

    /// <summary>DELETE /api/boards/:id</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var q = _db.Database.GetDbConnection();
        await q.OpenAsync(ct);
        try
        {
            using var cmd = q.CreateCommand();
            cmd.CommandText = "DELETE FROM Boards WHERE Id = @id AND UserId = @uid";
            cmd.Parameters.Add(new NpgsqlParameter("@id", id.ToString()));
            cmd.Parameters.Add(new NpgsqlParameter("@uid", UserId.ToString()));
            var rows = await cmd.ExecuteNonQueryAsync(ct);
            if (rows == 0) return NotFound();
        }
        finally { await q.CloseAsync(); }

        return NoContent();
    }
}

public class CreateBoardReq
{
    public string? Name { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Data { get; set; }
}

public class UpdateBoardReq
{
    public string? Name { get; set; }
    public string? Data { get; set; }
}
