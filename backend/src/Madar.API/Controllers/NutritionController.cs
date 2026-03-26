using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/nutrition")]
public class NutritionController : ControllerBase
{
    private readonly MadarDbContext _db;
    public NutritionController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ═══ DISHES ══════════════════════════════════════════════════════════

    [HttpGet("dishes")]
    public async Task<IActionResult> GetDishes([FromQuery] string? mealType, CancellationToken ct)
    {
        var sql = "SELECT * FROM Dishes WHERE UserId=@uid AND IsActive=1 ORDER BY IsDailyFavorite DESC, Frequency, Name";
        var rows = await Q(sql, [new("@uid", Uid)], ct);
        if (mealType != null)
            rows = rows.Where(r => (r["suitableFor"]?.ToString() ?? "").Contains(mealType)).ToList();
        return Ok(rows);
    }

    [HttpPost("dishes")]
    public async Task<IActionResult> CreateDish([FromBody] DishReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        var suitableFor = req.SuitableFor != null ? System.Text.Json.JsonSerializer.Serialize(req.SuitableFor) : "[\"lunch\"]";
        var prefDays = req.PreferredDays != null ? System.Text.Json.JsonSerializer.Serialize(req.PreferredDays) : null;
        await E(@"INSERT INTO Dishes (Id,UserId,Name,Description,ImageUrl,SuitableFor,Frequency,PreferredDays,IsDailyFavorite,IsForGuests,PrepTime,Calories,Servings)
            VALUES(@id,@uid,@n,@d,@img,@sf,@freq,@pd,@df,@fg,@pt,@cal,@srv)",
            [new("@id",id),new("@uid",Uid),new("@n",req.Name??""),new("@d",(object?)req.Description??DBNull.Value),
             new("@img",(object?)req.ImageUrl??DBNull.Value),new("@sf",suitableFor),
             new("@freq",req.Frequency??"occasional"),new("@pd",(object?)prefDays??DBNull.Value),
             new("@df",req.IsDailyFavorite??false),new("@fg",req.IsForGuests??false),
             new("@pt",(object?)req.PrepTime??DBNull.Value),new("@cal",(object?)req.Calories??DBNull.Value),
             new("@srv",req.Servings??4)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpGet("dishes/{id}")]
    public async Task<IActionResult> GetDish(string id, CancellationToken ct)
    {
        var dish = await Q("SELECT * FROM Dishes WHERE Id=@id AND UserId=@uid", [new("@id",id),new("@uid",Uid)], ct);
        if (dish.Count == 0) return NotFound();
        var ings = await Q(@"SELECT di.*, i.Name as IngredientName, i.Category
            FROM DishIngredients di JOIN Ingredients i ON di.IngredientId=i.Id WHERE di.DishId=@did",
            [new("@did",id)], ct);
        dish[0]["ingredients"] = ings;
        return Ok(dish[0]);
    }

    [HttpPut("dishes/{id}")]
    public async Task<IActionResult> UpdateDish(string id, [FromBody] DishReq req, CancellationToken ct)
    {
        var sets = new List<string>();
        var ps = new List<MySqlParameter> { new("@id",id), new("@uid",Uid) };
        if (req.Name != null) { sets.Add("Name=@n"); ps.Add(new("@n",req.Name)); }
        if (req.Description != null) { sets.Add("Description=@d"); ps.Add(new("@d",req.Description)); }
        if (req.ImageUrl != null) { sets.Add("ImageUrl=@img"); ps.Add(new("@img",req.ImageUrl)); }
        if (req.SuitableFor != null) { sets.Add("SuitableFor=@sf"); ps.Add(new("@sf",System.Text.Json.JsonSerializer.Serialize(req.SuitableFor))); }
        if (req.Frequency != null) { sets.Add("Frequency=@freq"); ps.Add(new("@freq",req.Frequency)); }
        if (req.PreferredDays != null) { sets.Add("PreferredDays=@pd"); ps.Add(new("@pd",System.Text.Json.JsonSerializer.Serialize(req.PreferredDays))); }
        if (req.IsDailyFavorite.HasValue) { sets.Add("IsDailyFavorite=@df"); ps.Add(new("@df",req.IsDailyFavorite.Value)); }
        if (req.IsForGuests.HasValue) { sets.Add("IsForGuests=@fg"); ps.Add(new("@fg",req.IsForGuests.Value)); }
        if (req.PrepTime.HasValue) { sets.Add("PrepTime=@pt"); ps.Add(new("@pt",req.PrepTime.Value)); }
        if (req.Servings.HasValue) { sets.Add("Servings=@srv"); ps.Add(new("@srv",req.Servings.Value)); }
        if (sets.Count == 0) return Ok(new { id });
        var rows = await E($"UPDATE Dishes SET {string.Join(",",sets)} WHERE Id=@id AND UserId=@uid", ps, ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("dishes/{id}")]
    public async Task<IActionResult> DeleteDish(string id, CancellationToken ct)
    {
        await E("DELETE FROM DishIngredients WHERE DishId=@id", [new("@id",id)], ct);
        var rows = await E("DELETE FROM Dishes WHERE Id=@id AND UserId=@uid", [new("@id",id),new("@uid",Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    [HttpPost("dishes/{dishId}/ingredients")]
    public async Task<IActionResult> AddDishIngredient(string dishId, [FromBody] DishIngReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E("INSERT INTO DishIngredients (Id,DishId,IngredientId,Quantity,Unit) VALUES(@id,@did,@iid,@q,@u)",
            [new("@id",id),new("@did",dishId),new("@iid",req.IngredientId??""),new("@q",req.Quantity??1),new("@u",req.Unit??"جرام")], ct);
        return Ok(new { id });
    }

    [HttpDelete("dishes/{dishId}/ingredients/{ingId}")]
    public async Task<IActionResult> RemoveDishIngredient(string dishId, string ingId, CancellationToken ct)
    {
        await E("DELETE FROM DishIngredients WHERE Id=@id AND DishId=@did", [new("@id",ingId),new("@did",dishId)], ct);
        return NoContent();
    }

    // ═══ INGREDIENTS ═════════════════════════════════════════════════════

    [HttpGet("ingredients")]
    public async Task<IActionResult> GetIngredients(CancellationToken ct)
    {
        var items = await Q("SELECT * FROM Ingredients WHERE UserId=@uid ORDER BY Category, Name", [new("@uid", Uid)], ct);
        foreach (var item in items)
        {
            var iid = item["id"]?.ToString() ?? "";
            item["brands"] = await Q(@"SELECT ib.*,
                (SELECT Price FROM IngredientPrices WHERE BrandId=ib.Id ORDER BY PurchaseDate DESC LIMIT 1) as LastPrice,
                (SELECT AVG(Price) FROM (SELECT Price FROM IngredientPrices WHERE BrandId=ib.Id ORDER BY PurchaseDate DESC LIMIT 5) sub) as AvgPrice
                FROM IngredientBrands ib WHERE ib.IngredientId=@iid AND ib.IsActive=1 ORDER BY ib.IsPreferred DESC",
                [new("@iid", iid)], ct);
        }
        return Ok(items);
    }

    [HttpPost("ingredients")]
    public async Task<IActionResult> CreateIngredient([FromBody] IngredientReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E("INSERT INTO Ingredients (Id,UserId,Name,Category,Unit,CurrentStock,MinStock) VALUES(@id,@uid,@n,@cat,@u,@cs,@ms)",
            [new("@id",id),new("@uid",Uid),new("@n",req.Name??""),new("@cat",req.Category??"بقالة"),
             new("@u",req.Unit??"كيلو"),new("@cs",req.CurrentStock??0),new("@ms",req.MinStock??0)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpPost("ingredients/{ingredientId}/brands")]
    public async Task<IActionResult> AddBrand(string ingredientId, [FromBody] BrandReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E("INSERT INTO IngredientBrands (Id,IngredientId,BrandName,Quality,Notes,IsPreferred) VALUES(@id,@iid,@bn,@q,@n,@pref)",
            [new("@id",id),new("@iid",ingredientId),new("@bn",req.BrandName??""),new("@q",req.Quality??"جيدة"),
             new("@n",(object?)req.Notes??DBNull.Value),new("@pref",req.IsPreferred??false)], ct);
        return Ok(new { id });
    }

    [HttpPost("ingredients/{ingredientId}/prices")]
    public async Task<IActionResult> RecordPrice(string ingredientId, [FromBody] PriceReq req, CancellationToken ct)
    {
        var priceType = "عادي";
        if (req.BrandId != null)
        {
            var avgRows = await Q("SELECT AVG(Price) as avg FROM (SELECT Price FROM IngredientPrices WHERE IngredientId=@iid AND BrandId=@bid ORDER BY PurchaseDate DESC LIMIT 5) sub",
                [new("@iid",ingredientId),new("@bid",req.BrandId)], ct);
            if (avgRows.Count > 0 && avgRows[0]["avg"] != null)
            {
                var avg = Convert.ToDecimal(avgRows[0]["avg"]);
                if (avg > 0) { var d = ((req.Price??0)-avg)/avg; priceType = d<=-0.1m?"مخفض":d>=0.1m?"غالي":"عادي"; }
            }
        }
        var id = Guid.NewGuid().ToString();
        await E("INSERT INTO IngredientPrices (Id,IngredientId,BrandId,Price,Quantity,Unit,PriceType,Store,Notes) VALUES(@id,@iid,@bid,@p,@q,@u,@pt,@st,@n)",
            [new("@id",id),new("@iid",ingredientId),new("@bid",(object?)req.BrandId??DBNull.Value),
             new("@p",req.Price??0),new("@q",req.Quantity??1),new("@u",req.Unit??"كيلو"),
             new("@pt",priceType),new("@st",(object?)req.Store??DBNull.Value),new("@n",(object?)req.Notes??DBNull.Value)], ct);
        if ((req.Quantity??0)>0)
            await E("UPDATE Ingredients SET CurrentStock=CurrentStock+@q WHERE Id=@iid",[new("@iid",ingredientId),new("@q",req.Quantity??0)], ct);
        return Ok(new { id, priceType });
    }

    [HttpGet("ingredients/{ingredientId}/price-history")]
    public async Task<IActionResult> PriceHistory(string ingredientId, CancellationToken ct) =>
        Ok(await Q("SELECT ip.*,ib.BrandName FROM IngredientPrices ip LEFT JOIN IngredientBrands ib ON ip.BrandId=ib.Id WHERE ip.IngredientId=@iid ORDER BY ip.PurchaseDate DESC LIMIT 50",
            [new("@iid",ingredientId)], ct));

    // ═══ MEAL PLANS ══════════════════════════════════════════════════════

    [HttpGet("meal-plans")]
    public async Task<IActionResult> GetMealPlans([FromQuery] string? weekStart, CancellationToken ct)
    {
        var start = weekStart != null ? DateTime.Parse(weekStart) : StartOfWeek(DateTime.UtcNow);
        var end = start.AddDays(7);
        var rows = await Q(@"SELECT mp.*, d.Name as DishName, d.ImageUrl as DishImage
            FROM DishMealPlans mp JOIN Dishes d ON mp.DishId=d.Id
            WHERE mp.UserId=@uid AND mp.PlanDate>=@s AND mp.PlanDate<@e ORDER BY mp.PlanDate, mp.MealType",
            [new("@uid",Uid),new("@s",start),new("@e",end)], ct);
        // Group by date → mealType → dishes[]
        var grouped = rows.GroupBy(r => r["planDate"]?.ToString()?.Split("T")[0] ?? "").Select(g => new {
            date = g.Key,
            meals = g.GroupBy(r => r["mealType"]?.ToString() ?? "").ToDictionary(
                mg => mg.Key,
                mg => mg.Select(r => new { id = r["dishId"], name = r["dishName"], image = r["dishImage"] }).ToList()
            )
        });
        return Ok(grouped);
    }

    [HttpPost("meal-plans")]
    public async Task<IActionResult> SetMealPlan([FromBody] MealPlanReq req, CancellationToken ct)
    {
        // Remove existing for this date+mealType
        await E("DELETE FROM DishMealPlans WHERE UserId=@uid AND PlanDate=@d AND MealType=@mt",
            [new("@uid",Uid),new("@d",req.Date),new("@mt",req.MealType??"lunch")], ct);
        // Add new dishes
        foreach (var dishId in req.DishIds ?? [])
        {
            await E("INSERT INTO DishMealPlans (Id,UserId,PlanDate,MealType,DishId,IsGuestDay) VALUES(@id,@uid,@d,@mt,@did,@g)",
                [new("@id",Guid.NewGuid().ToString()),new("@uid",Uid),new("@d",req.Date),
                 new("@mt",req.MealType??"lunch"),new("@did",dishId),new("@g",req.IsGuestDay??false)], ct);
        }
        return Ok(new { date = req.Date, mealType = req.MealType, count = (req.DishIds?.Count ?? 0) });
    }

    [HttpPost("meal-plans/auto-generate")]
    public async Task<IActionResult> AutoGenerate([FromQuery] string? weekStart, CancellationToken ct)
    {
        var start = weekStart != null ? DateTime.Parse(weekStart) : StartOfWeek(DateTime.UtcNow);
        var dishes = await Q("SELECT * FROM Dishes WHERE UserId=@uid AND IsActive=1 AND IsForGuests=0", [new("@uid",Uid)], ct);
        if (dishes.Count == 0) return BadRequest(new { error = "لا توجد أطباق" });

        // Clear existing auto-generated
        await E("DELETE FROM DishMealPlans WHERE UserId=@uid AND PlanDate>=@s AND PlanDate<@e AND IsAutoGenerated=1",
            [new("@uid",Uid),new("@s",start),new("@e",start.AddDays(7))], ct);

        var daily = dishes.Where(d => Convert.ToBoolean(d["isDailyFavorite"]??false)).ToList();
        var weekly = dishes.Where(d => (d["frequency"]?.ToString()??"")=="weekly").ToList();
        var occasional = dishes.Where(d => !Convert.ToBoolean(d["isDailyFavorite"]??false) && (d["frequency"]?.ToString()??"")!="weekly").ToList();
        var rng = new Random();
        var mealTypes = new[] { "breakfast", "lunch", "dinner" };

        for (int day = 0; day < 7; day++)
        {
            var date = start.AddDays(day);
            var dayOfWeek = (int)date.DayOfWeek;

            foreach (var mt in mealTypes)
            {
                var chosen = new List<string>();
                // Daily favorites suitable for this meal
                foreach (var d in daily.Where(d => (d["suitableFor"]?.ToString()??"").Contains(mt)))
                    chosen.Add(d["id"]!.ToString()!);
                // Weekly dishes for this day
                foreach (var d in weekly.Where(d => (d["suitableFor"]?.ToString()??"").Contains(mt) && (d["preferredDays"]?.ToString()??"").Contains(dayOfWeek.ToString())))
                    chosen.Add(d["id"]!.ToString()!);
                // If nothing yet, pick random occasional
                if (chosen.Count == 0)
                {
                    var candidates = occasional.Where(d => (d["suitableFor"]?.ToString()??"").Contains(mt)).ToList();
                    if (candidates.Count > 0) chosen.Add(candidates[rng.Next(candidates.Count)]["id"]!.ToString()!);
                }

                foreach (var did in chosen)
                    await E("INSERT INTO DishMealPlans (Id,UserId,PlanDate,MealType,DishId,IsAutoGenerated) VALUES(@id,@uid,@d,@mt,@did,1)",
                        [new("@id",Guid.NewGuid().ToString()),new("@uid",Uid),new("@d",date),new("@mt",mt),new("@did",did)], ct);
            }
        }
        return Ok(new { message = "تم التوليد", days = 7 });
    }

    // ═══ SHOPPING ════════════════════════════════════════════════════════

    [HttpPost("shopping/generate")]
    public async Task<IActionResult> GenerateShoppingList([FromQuery] string? weekStart, CancellationToken ct)
    {
        var start = weekStart != null ? DateTime.Parse(weekStart) : StartOfWeek(DateTime.UtcNow);
        var end = start.AddDays(7);
        var dishIds = (await Q("SELECT DISTINCT DishId FROM DishMealPlans WHERE UserId=@uid AND PlanDate>=@s AND PlanDate<@e",
            [new("@uid",Uid),new("@s",start),new("@e",end)], ct)).Select(r => r["dishId"]!.ToString()!).ToList();
        if (dishIds.Count == 0) return Ok(new { message = "لا توجد أطباق مخططة" });

        var ph = string.Join(",", dishIds.Select((_,i) => $"@m{i}"));
        var ps = dishIds.Select((m,i) => new MySqlParameter($"@m{i}",m)).ToList();
        var ings = await Q($@"SELECT di.IngredientId, i.Name, i.Unit, i.CurrentStock, SUM(di.Quantity) as TotalNeeded,
            (SELECT ib.Id FROM IngredientBrands ib WHERE ib.IngredientId=di.IngredientId AND ib.IsPreferred=1 LIMIT 1) as BrandId,
            (SELECT ib.BrandName FROM IngredientBrands ib WHERE ib.IngredientId=di.IngredientId AND ib.IsPreferred=1 LIMIT 1) as BrandName,
            (SELECT ip.Price FROM IngredientPrices ip WHERE ip.IngredientId=di.IngredientId ORDER BY ip.PurchaseDate DESC LIMIT 1) as LastPrice
            FROM DishIngredients di JOIN Ingredients i ON di.IngredientId=i.Id WHERE di.DishId IN ({ph}) GROUP BY di.IngredientId",
            ps, ct);

        var listId = Guid.NewGuid().ToString();
        decimal total = 0;
        await E("INSERT INTO ShoppingLists (Id,UserId,Status) VALUES(@id,@uid,'pending')",[new("@id",listId),new("@uid",Uid)], ct);
        foreach (var ing in ings)
        {
            var needed = Convert.ToDecimal(ing["totalNeeded"]??0);
            var stock = Convert.ToDecimal(ing["currentStock"]??0);
            var toBuy = Math.Max(0, needed-stock);
            var price = ing["lastPrice"]!=null?Convert.ToDecimal(ing["lastPrice"]):0;
            var est = toBuy*price; total += est;
            await E("INSERT INTO ShoppingListItems (Id,ShoppingListId,IngredientId,BrandId,RequiredQuantity,CurrentStock,ToBuyQuantity,EstimatedCost) VALUES(@id,@lid,@iid,@bid,@rq,@cs,@tb,@ec)",
                [new("@id",Guid.NewGuid().ToString()),new("@lid",listId),new("@iid",ing["ingredientId"]?.ToString()??""),
                 new("@bid",(object?)ing["brandId"]??DBNull.Value),new("@rq",needed),new("@cs",stock),new("@tb",toBuy),new("@ec",est)], ct);
        }
        await E("UPDATE ShoppingLists SET TotalEstimatedCost=@c WHERE Id=@id",[new("@id",listId),new("@c",total)], ct);
        return Ok(new { id = listId, totalEstimatedCost = total, itemCount = ings.Count });
    }

    [HttpGet("shopping/{listId}")]
    public async Task<IActionResult> GetShoppingList(string listId, CancellationToken ct)
    {
        var list = await Q("SELECT * FROM ShoppingLists WHERE Id=@id AND UserId=@uid",[new("@id",listId),new("@uid",Uid)], ct);
        if (list.Count==0) return NotFound();
        list[0]["items"] = await Q(@"SELECT si.*,i.Name as IngredientName,i.Unit as IngredientUnit,i.Category,ib.BrandName
            FROM ShoppingListItems si JOIN Ingredients i ON si.IngredientId=i.Id LEFT JOIN IngredientBrands ib ON si.BrandId=ib.Id
            WHERE si.ShoppingListId=@lid ORDER BY i.Category,i.Name",[new("@lid",listId)], ct);
        return Ok(list[0]);
    }

    [HttpPatch("shopping/items/{itemId}/purchase")]
    public async Task<IActionResult> PurchaseItem(string itemId, [FromBody] PurchaseReq req, CancellationToken ct)
    {
        var items = await Q("SELECT si.*,sl.UserId FROM ShoppingListItems si JOIN ShoppingLists sl ON si.ShoppingListId=sl.Id WHERE si.Id=@id",[new("@id",itemId)], ct);
        if (items.Count==0) return NotFound();
        if (items[0]["userId"]?.ToString()!=Uid) return Forbid();
        var ingredientId = items[0]["ingredientId"]?.ToString()??"";
        var qty = req.Quantity??Convert.ToDecimal(items[0]["toBuyQuantity"]??0);
        var cost = (req.ActualPrice??0)*qty;
        var priceType = "عادي";
        if (req.BrandId!=null)
        {
            var avg = await Q("SELECT AVG(Price) as avg FROM (SELECT Price FROM IngredientPrices WHERE IngredientId=@iid AND BrandId=@bid ORDER BY PurchaseDate DESC LIMIT 5) sub",
                [new("@iid",ingredientId),new("@bid",req.BrandId)], ct);
            if (avg.Count>0&&avg[0]["avg"]!=null) { var a=Convert.ToDecimal(avg[0]["avg"]); if(a>0){var d=((req.ActualPrice??0)-a)/a; priceType=d<=-0.1m?"مخفض":d>=0.1m?"غالي":"عادي";} }
        }
        await E("UPDATE ShoppingListItems SET IsPurchased=1,ActualCost=@ac,ActualPrice=@ap,PriceType=@pt,Store=@st,BrandId=COALESCE(@bid,BrandId) WHERE Id=@id",
            [new("@id",itemId),new("@ac",cost),new("@ap",req.ActualPrice??0),new("@pt",priceType),new("@st",(object?)req.Store??DBNull.Value),new("@bid",(object?)req.BrandId??DBNull.Value)], ct);
        await E("INSERT INTO IngredientPrices (Id,IngredientId,BrandId,Price,Quantity,Unit,PriceType,Store) VALUES(@id,@iid,@bid,@p,@q,'unit',@pt,@st)",
            [new("@id",Guid.NewGuid().ToString()),new("@iid",ingredientId),new("@bid",(object?)req.BrandId??DBNull.Value),
             new("@p",req.ActualPrice??0),new("@q",qty),new("@pt",priceType),new("@st",(object?)req.Store??DBNull.Value)], ct);
        await E("UPDATE Ingredients SET CurrentStock=CurrentStock+@q WHERE Id=@iid",[new("@iid",ingredientId),new("@q",qty)], ct);
        var lid = items[0]["shoppingListId"]?.ToString()??"";
        await E("UPDATE ShoppingLists SET TotalActualCost=(SELECT COALESCE(SUM(ActualCost),0) FROM ShoppingListItems WHERE ShoppingListId=@lid AND IsPurchased=1) WHERE Id=@lid",[new("@lid",lid)], ct);
        return Ok(new { itemId, priceType, actualCost = cost });
    }

    // ═══ HELPERS ══════════════════════════════════════════════════════════

    private static DateTime StartOfWeek(DateTime dt) { int diff = ((int)dt.DayOfWeek + 1) % 7; return dt.AddDays(-diff).Date; } // Saturday start

    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State==System.Data.ConnectionState.Open; if(!w) await conn.OpenAsync(ct);
        try { using var cmd=conn.CreateCommand(); cmd.CommandText=sql; foreach(var p in ps) cmd.Parameters.Add(p);
            using var r=await cmd.ExecuteReaderAsync(ct); var rows=new List<Dictionary<string,object?>>();
            while(await r.ReadAsync(ct)){var row=new Dictionary<string,object?>();for(int i=0;i<r.FieldCount;i++)row[char.ToLowerInvariant(r.GetName(i)[0])+r.GetName(i)[1..]]=r.IsDBNull(i)?null:r.GetValue(i);rows.Add(row);}return rows;
        } finally { if(!w) await conn.CloseAsync(); }
    }

    private async Task<int> E(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State==System.Data.ConnectionState.Open; if(!w) await conn.OpenAsync(ct);
        try { using var cmd=conn.CreateCommand(); cmd.CommandText=sql; foreach(var p in ps) cmd.Parameters.Add(p); return await cmd.ExecuteNonQueryAsync(ct);
        } finally { if(!w) await conn.CloseAsync(); }
    }
}

public class DishReq { public string? Name{get;set;} public string? Description{get;set;} public string? ImageUrl{get;set;} public List<string>? SuitableFor{get;set;} public string? Frequency{get;set;} public List<int>? PreferredDays{get;set;} public bool? IsDailyFavorite{get;set;} public bool? IsForGuests{get;set;} public int? PrepTime{get;set;} public int? Calories{get;set;} public int? Servings{get;set;} }
public class DishIngReq { public string? IngredientId{get;set;} public decimal? Quantity{get;set;} public string? Unit{get;set;} }
public class MealPlanReq { public DateTime Date{get;set;} public string? MealType{get;set;} public List<string>? DishIds{get;set;} public bool? IsGuestDay{get;set;} }
