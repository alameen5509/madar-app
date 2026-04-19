using System.Security.Claims;
using System.Text.Json;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Madar.API.Controllers;

[Authorize, ApiController, Route("api/nutrition")]
public class NutritionController : ControllerBase
{
    private readonly MadarDbContext _db;
    public NutritionController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ═══ DISHES (صحون) ═══════════════════════════════════════════════

    [HttpGet("dishes")]
    public async Task<IActionResult> GetDishes(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM Dishes WHERE UserId=@uid AND IsActive=1 ORDER BY Category, Name", Ps("@uid", Uid), ct));

    [HttpPost("dishes")]
    public async Task<IActionResult> CreateDish([FromBody] DishReq req, CancellationToken ct)
    {
        var id = NewId();
        await E("INSERT INTO Dishes (Id,UserId,Name,Description,ImageUrl,ImageData,Category,PrepTime,Calories,Servings) VALUES(@id,@uid,@n,@d,@img,@imgd,@cat,@pt,@cal,@srv)",
            [P("@id",id),P("@uid",Uid),P("@n",req.Name??""),P("@d",req.Description),P("@img",req.ImageUrl),P("@imgd",req.ImageData),
             P("@cat",req.Category??"أساسي"),P("@pt",req.PrepTime),P("@cal",req.Calories),P("@srv",req.Servings??4)], ct);
        // Add ingredients inline
        if (req.Ingredients != null)
            foreach (var ing in req.Ingredients)
            {
                var ingId = ing.IngredientId;
                if (string.IsNullOrEmpty(ingId))
                {
                    ingId = NewId();
                    await E("INSERT INTO Ingredients (Id,UserId,Name,Category,Unit,CurrentStock,MinStock) VALUES(@id,@uid,@n,'بقالة',@u,0,0)",
                        [P("@id",ingId),P("@uid",Uid),P("@n",ing.Name??""),P("@u",ing.Unit??"جرام")], ct);
                }
                await E("INSERT INTO DishIngredients (Id,DishId,IngredientId,Quantity,Unit) VALUES(@id,@did,@iid,@q,@u)",
                    [P("@id",NewId()),P("@did",id),P("@iid",ingId),P("@q",ing.Quantity??1),P("@u",ing.Unit??"جرام")], ct);
            }
        return Ok(new { id, name = req.Name });
    }

    [HttpGet("dishes/{id}")]
    public async Task<IActionResult> GetDish(string id, CancellationToken ct)
    {
        var d = await Q("SELECT * FROM Dishes WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct);
        if (d.Count == 0) return NotFound();
        d[0]["ingredients"] = await Q("SELECT di.*,i.Name as IngredientName,i.Category FROM DishIngredients di JOIN Ingredients i ON di.IngredientId=i.Id WHERE di.DishId=@did", Ps("@did",id), ct);
        return Ok(d[0]);
    }

    [HttpDelete("dishes/{id}")]
    public async Task<IActionResult> DeleteDish(string id, CancellationToken ct)
    {
        await E("DELETE FROM DishIngredients WHERE DishId=@id", Ps("@id",id), ct);
        await E("DELETE FROM MealDishes WHERE DishId=@id", Ps("@id",id), ct);
        return (await E("DELETE FROM Dishes WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    // ═══ MEALS (وجبات = مجموعة صحون) ════════════════════════════════

    [HttpGet("meals")]
    public async Task<IActionResult> GetMeals(CancellationToken ct)
    {
        var meals = await Q("SELECT * FROM Meals WHERE UserId=@uid AND IsActive=1 ORDER BY IsDailyFavorite DESC, Frequency, Name", Ps("@uid",Uid), ct);
        foreach (var m in meals)
            m["dishes"] = await Q("SELECT md.*,d.Name as DishName,d.ImageUrl as DishImage,d.ImageData as DishImageData,d.Category FROM MealDishes md JOIN Dishes d ON md.DishId=d.Id WHERE md.MealId=@mid ORDER BY md.DisplayOrder",
                Ps("@mid",m["id"]?.ToString()??""), ct);
        return Ok(meals);
    }

    [HttpPost("meals")]
    public async Task<IActionResult> CreateMeal([FromBody] MealReq2 req, CancellationToken ct)
    {
        var id = NewId();
        var pd = req.PreferredDays != null ? JsonSerializer.Serialize(req.PreferredDays) : null;
        await E("INSERT INTO Meals (Id,UserId,Name,MealTime,Frequency,PreferredDays,IsDailyFavorite,IsForGuests) VALUES(@id,@uid,@n,@mt,@f,@pd,@df,@fg)",
            [P("@id",id),P("@uid",Uid),P("@n",req.Name??""),P("@mt",req.MealTime??"lunch"),
             P("@f",req.Frequency??"occasional"),P("@pd",pd),P("@df",req.IsDailyFavorite??false),P("@fg",req.IsForGuests??false)], ct);
        if (req.DishIds != null)
            for (int i = 0; i < req.DishIds.Count; i++)
                await E("INSERT INTO MealDishes (Id,MealId,DishId,DisplayOrder) VALUES(@id,@mid,@did,@o)",
                    [P("@id",NewId()),P("@mid",id),P("@did",req.DishIds[i]),P("@o",i)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpPut("meals/{id}")]
    public async Task<IActionResult> UpdateMeal(string id, [FromBody] MealReq2 req, CancellationToken ct)
    {
        await E("UPDATE Meals SET Name=COALESCE(@n,Name),MealTime=COALESCE(@mt,MealTime),Frequency=COALESCE(@f,Frequency),IsDailyFavorite=COALESCE(@df,IsDailyFavorite),IsForGuests=COALESCE(@fg,IsForGuests) WHERE Id=@id AND UserId=@uid",
            [P("@id",id),P("@uid",Uid),P("@n",req.Name),P("@mt",req.MealTime),P("@f",req.Frequency),P("@df",req.IsDailyFavorite),P("@fg",req.IsForGuests)], ct);
        if (req.DishIds != null) {
            await E("DELETE FROM MealDishes WHERE MealId=@mid", Ps("@mid",id), ct);
            for (int i = 0; i < req.DishIds.Count; i++)
                await E("INSERT INTO MealDishes (Id,MealId,DishId,DisplayOrder) VALUES(@id,@mid,@did,@o)",
                    [P("@id",NewId()),P("@mid",id),P("@did",req.DishIds[i]),P("@o",i)], ct);
        }
        return Ok(new { id });
    }

    [HttpDelete("meals/{id}")]
    public async Task<IActionResult> DeleteMeal(string id, CancellationToken ct)
    {
        await E("DELETE FROM MealDishes WHERE MealId=@id", Ps("@id",id), ct);
        return (await E("DELETE FROM Meals WHERE Id=@id AND UserId=@uid", [P("@id",id),P("@uid",Uid)], ct)) > 0 ? NoContent() : NotFound();
    }

    [HttpPost("meals/{mealId}/dishes")]
    public async Task<IActionResult> AddDishToMeal(string mealId, [FromBody] AddDishReq req, CancellationToken ct)
    {
        var ord = await Q("SELECT MAX(DisplayOrder) as mx FROM MealDishes WHERE MealId=@mid", Ps("@mid",mealId), ct);
        var next = (ord.Count > 0 && ord[0]["mx"] != null ? Convert.ToInt32(ord[0]["mx"]) : -1) + 1;
        await E("INSERT INTO MealDishes (Id,MealId,DishId,DisplayOrder) VALUES(@id,@mid,@did,@o)",
            [P("@id",NewId()),P("@mid",mealId),P("@did",req.DishId??""),P("@o",next)], ct);
        return Ok(new { mealId, dishId = req.DishId });
    }

    [HttpDelete("meals/{mealId}/dishes/{dishId}")]
    public async Task<IActionResult> RemoveDishFromMeal(string mealId, string dishId, CancellationToken ct)
    {
        await E("DELETE FROM MealDishes WHERE MealId=@mid AND DishId=@did", [P("@mid",mealId),P("@did",dishId)], ct);
        return NoContent();
    }

    // ═══ INGREDIENTS ═════════════════════════════════════════════════

    [HttpGet("ingredients")]
    public async Task<IActionResult> GetIngredients(CancellationToken ct)
    {
        var items = await Q("SELECT * FROM Ingredients WHERE UserId=@uid ORDER BY Category, Name", Ps("@uid",Uid), ct);
        foreach (var i in items)
            i["brands"] = await Q(@"SELECT ib.*,
                (SELECT Price FROM IngredientPrices WHERE BrandId=ib.Id ORDER BY PurchaseDate DESC LIMIT 1) as LastPrice,
                (SELECT AVG(Price) FROM (SELECT Price FROM IngredientPrices WHERE BrandId=ib.Id ORDER BY PurchaseDate DESC LIMIT 5) sub) as AvgPrice
                FROM IngredientBrands ib WHERE ib.IngredientId=@iid AND ib.IsActive=1 ORDER BY ib.IsPreferred DESC",
                Ps("@iid",i["id"]?.ToString()??""), ct);
        return Ok(items);
    }

    [HttpPost("ingredients/{iid}/brands")]
    public async Task<IActionResult> AddBrand(string iid, [FromBody] BrandReq req, CancellationToken ct)
    {
        var id = NewId();
        await E("INSERT INTO IngredientBrands (Id,IngredientId,BrandName,Quality,Notes,IsPreferred) VALUES(@id,@iid,@bn,@q,@n,@p)",
            [P("@id",id),P("@iid",iid),P("@bn",req.BrandName??""),P("@q",req.Quality??"جيدة"),P("@n",req.Notes),P("@p",req.IsPreferred??false)], ct);
        return Ok(new { id });
    }

    [HttpPost("ingredients/{iid}/prices")]
    public async Task<IActionResult> RecordPrice(string iid, [FromBody] PriceReq req, CancellationToken ct)
    {
        var pt = "عادي";
        if (req.BrandId != null) {
            var a = await Q("SELECT AVG(Price) as avg FROM (SELECT Price FROM IngredientPrices WHERE IngredientId=@iid AND BrandId=@bid ORDER BY PurchaseDate DESC LIMIT 5) sub",
                [P("@iid",iid),P("@bid",req.BrandId)], ct);
            if (a.Count > 0 && a[0]["avg"] != null) { var avg = Convert.ToDecimal(a[0]["avg"]); if (avg > 0) { var d = ((req.Price??0)-avg)/avg; pt = d<=-0.1m?"مخفض":d>=0.1m?"غالي":"عادي"; } }
        }
        await E("INSERT INTO IngredientPrices (Id,IngredientId,BrandId,Price,Quantity,Unit,PriceType,Store) VALUES(@id,@iid,@bid,@p,@q,@u,@pt,@st)",
            [P("@id",NewId()),P("@iid",iid),P("@bid",req.BrandId),P("@p",req.Price??0),P("@q",req.Quantity??1),P("@u",req.Unit??"كيلو"),P("@pt",pt),P("@st",req.Store)], ct);
        if ((req.Quantity??0)>0) await E("UPDATE Ingredients SET CurrentStock=CurrentStock+@q WHERE Id=@iid",[P("@iid",iid),P("@q",req.Quantity??0)], ct);
        return Ok(new { priceType = pt });
    }

    // ═══ MEAL PLANS ══════════════════════════════════════════════════

    [HttpGet("meal-plans")]
    public async Task<IActionResult> GetMealPlans([FromQuery] string? weekStart, CancellationToken ct)
    {
        var s = weekStart != null ? DateTime.Parse(weekStart) : StartOfWeek(DateTime.UtcNow);
        var plans = await Q(@"SELECT mp.*,
            bm.Name as BreakfastName, lm.Name as LunchName, dm.Name as DinnerName, sm.Name as SnackName
            FROM MealPlans mp
            LEFT JOIN Meals bm ON mp.BreakfastMealId=bm.Id LEFT JOIN Meals lm ON mp.LunchMealId=lm.Id
            LEFT JOIN Meals dm ON mp.DinnerMealId=dm.Id LEFT JOIN Meals sm ON mp.SnackMealId=sm.Id
            WHERE mp.UserId=@uid AND mp.PlanDate>=@s AND mp.PlanDate<@e ORDER BY mp.PlanDate",
            [P("@uid",Uid),P("@s",s),P("@e",s.AddDays(7))], ct);
        return Ok(plans);
    }

    [HttpPost("meal-plans")]
    public async Task<IActionResult> SetMealPlan([FromBody] PlanReq req, CancellationToken ct)
    {
        var id = NewId();
        await E(@"INSERT INTO MealPlans (Id,UserId,PlanDate,BreakfastMealId,LunchMealId,DinnerMealId,SnackMealId)
            VALUES(@id,@uid,@d,@b,@l,@dn,@sn)
            ON DUPLICATE KEY UPDATE BreakfastMealId=VALUES(BreakfastMealId),LunchMealId=VALUES(LunchMealId),DinnerMealId=VALUES(DinnerMealId),SnackMealId=VALUES(SnackMealId)",
            [P("@id",id),P("@uid",Uid),P("@d",req.Date),P("@b",req.BreakfastMealId),P("@l",req.LunchMealId),P("@dn",req.DinnerMealId),P("@sn",req.SnackMealId)], ct);
        return Ok(new { date = req.Date });
    }

    [HttpPost("meal-plans/auto-generate")]
    public async Task<IActionResult> AutoGenerate([FromQuery] string? weekStart, CancellationToken ct)
    {
        var s = weekStart != null ? DateTime.Parse(weekStart) : StartOfWeek(DateTime.UtcNow);
        var meals = await Q("SELECT * FROM Meals WHERE UserId=@uid AND IsActive=1 AND IsForGuests=0", Ps("@uid",Uid), ct);
        if (meals.Count == 0) return BadRequest(new { error = "لا توجد وجبات" });
        await E("DELETE FROM MealPlans WHERE UserId=@uid AND PlanDate>=@s AND PlanDate<@e AND IsAutoGenerated=1", [P("@uid",Uid),P("@s",s),P("@e",s.AddDays(7))], ct);

        var daily = meals.Where(m => Convert.ToBoolean(m["isDailyFavorite"]??false)).ToList();
        var weekly = meals.Where(m => (m["frequency"]?.ToString()??"")=="weekly").ToList();
        var occasional = meals.Where(m => !Convert.ToBoolean(m["isDailyFavorite"]??false) && (m["frequency"]?.ToString()??"")!="weekly").ToList();
        var rng = new Random();
        var times = new[] { "breakfast", "lunch", "dinner" };
        var cols = new[] { "BreakfastMealId", "LunchMealId", "DinnerMealId" };

        for (int day = 0; day < 7; day++)
        {
            var date = s.AddDays(day);
            var dow = (int)date.DayOfWeek;
            var chosen = new Dictionary<string, string?>(); // mealTime → mealId

            foreach (var mt in times)
            {
                string? pick = null;
                // Daily
                var d = daily.FirstOrDefault(m => (m["mealTime"]?.ToString()??"") == mt);
                if (d != null) pick = d["id"]?.ToString();
                // Weekly for this day
                if (pick == null) { var w = weekly.FirstOrDefault(m => (m["mealTime"]?.ToString()??"") == mt && (m["preferredDays"]?.ToString()??"").Contains(dow.ToString())); if (w != null) pick = w["id"]?.ToString(); }
                // Random occasional
                if (pick == null) { var c = occasional.Where(m => (m["mealTime"]?.ToString()??"") == mt).ToList(); if (c.Count > 0) pick = c[rng.Next(c.Count)]["id"]?.ToString(); }
                chosen[mt] = pick;
            }

            await E(@"INSERT INTO MealPlans (Id,UserId,PlanDate,BreakfastMealId,LunchMealId,DinnerMealId,IsAutoGenerated)
                VALUES(@id,@uid,@d,@b,@l,@dn,1) ON DUPLICATE KEY UPDATE BreakfastMealId=VALUES(BreakfastMealId),LunchMealId=VALUES(LunchMealId),DinnerMealId=VALUES(DinnerMealId),IsAutoGenerated=1",
                [P("@id",NewId()),P("@uid",Uid),P("@d",date),P("@b",chosen.GetValueOrDefault("breakfast")),P("@l",chosen.GetValueOrDefault("lunch")),P("@dn",chosen.GetValueOrDefault("dinner"))], ct);
        }
        return Ok(new { message = "تم التوليد", days = 7 });
    }

    // ═══ SHOPPING ════════════════════════════════════════════════════

    [HttpPost("shopping/generate")]
    public async Task<IActionResult> GenShopping([FromQuery] string? weekStart, CancellationToken ct)
    {
        var s = weekStart != null ? DateTime.Parse(weekStart) : StartOfWeek(DateTime.UtcNow);
        // Get all meal IDs from plan
        var plans = await Q("SELECT BreakfastMealId,LunchMealId,DinnerMealId,SnackMealId FROM MealPlans WHERE UserId=@uid AND PlanDate>=@s AND PlanDate<@e",
            [P("@uid",Uid),P("@s",s),P("@e",s.AddDays(7))], ct);
        var mealIds = plans.SelectMany(p => new[] { p["breakfastMealId"],p["lunchMealId"],p["dinnerMealId"],p["snackMealId"] })
            .Where(x => x != null).Select(x => x!.ToString()!).Distinct().ToList();
        if (mealIds.Count == 0) return Ok(new { message = "لا توجد وجبات مخططة" });

        // Get dish IDs from meals
        var ph = string.Join(",", mealIds.Select((_,i)=>$"@m{i}"));
        var ps = mealIds.Select((m,i)=>new NpgsqlParameter($"@m{i}",m)).ToList();
        var dishIds = (await Q($"SELECT DISTINCT DishId FROM MealDishes WHERE MealId IN ({ph})", ps, ct)).Select(r=>r["dishId"]!.ToString()!).ToList();
        if (dishIds.Count == 0) return Ok(new { message = "لا توجد صحون" });

        // Aggregate ingredients
        var ph2 = string.Join(",", dishIds.Select((_,i)=>$"@d{i}"));
        var ps2 = dishIds.Select((d,i)=>new NpgsqlParameter($"@d{i}",d)).ToList();
        var ings = await Q($@"SELECT di.IngredientId, i.Name, i.Unit, i.CurrentStock, SUM(di.Quantity) as TotalNeeded,
            (SELECT ib.Id FROM IngredientBrands ib WHERE ib.IngredientId=di.IngredientId AND ib.IsPreferred=1 LIMIT 1) as BrandId,
            (SELECT ip.Price FROM IngredientPrices ip WHERE ip.IngredientId=di.IngredientId ORDER BY ip.PurchaseDate DESC LIMIT 1) as LastPrice
            FROM DishIngredients di JOIN Ingredients i ON di.IngredientId=i.Id WHERE di.DishId IN ({ph2}) GROUP BY di.IngredientId", ps2, ct);

        var lid = NewId(); decimal total = 0;
        await E("INSERT INTO ShoppingLists (Id,UserId,Status) VALUES(@id,@uid,'pending')",[P("@id",lid),P("@uid",Uid)], ct);
        foreach (var ing in ings) {
            var needed = Convert.ToDecimal(ing["totalNeeded"]??0); var stock = Convert.ToDecimal(ing["currentStock"]??0);
            var toBuy = Math.Max(0, needed-stock); var price = ing["lastPrice"]!=null?Convert.ToDecimal(ing["lastPrice"]):0;
            var est = toBuy*price; total += est;
            await E("INSERT INTO ShoppingListItems (Id,ShoppingListId,IngredientId,BrandId,RequiredQuantity,CurrentStock,ToBuyQuantity,EstimatedCost) VALUES(@id,@lid,@iid,@bid,@rq,@cs,@tb,@ec)",
                [P("@id",NewId()),P("@lid",lid),P("@iid",ing["ingredientId"]?.ToString()??""),P("@bid",ing["brandId"]),P("@rq",needed),P("@cs",stock),P("@tb",toBuy),P("@ec",est)], ct);
        }
        await E("UPDATE ShoppingLists SET TotalEstimatedCost=@c WHERE Id=@id",[P("@id",lid),P("@c",total)], ct);
        return Ok(new { id = lid, totalEstimatedCost = total, itemCount = ings.Count });
    }

    [HttpPatch("shopping/items/{itemId}/purchase")]
    public async Task<IActionResult> Purchase(string itemId, [FromBody] PurchaseReq req, CancellationToken ct)
    {
        var items = await Q("SELECT si.*,sl.UserId FROM ShoppingListItems si JOIN ShoppingLists sl ON si.ShoppingListId=sl.Id WHERE si.Id=@id", Ps("@id",itemId), ct);
        if (items.Count==0) return NotFound(); if (items[0]["userId"]?.ToString()!=Uid) return Forbid();
        var iid = items[0]["ingredientId"]?.ToString()??""; var qty = req.Quantity??Convert.ToDecimal(items[0]["toBuyQuantity"]??0);
        var cost = (req.ActualPrice??0)*qty; var pt = "عادي";
        if (req.BrandId!=null) {
            var a = await Q("SELECT AVG(Price) as avg FROM (SELECT Price FROM IngredientPrices WHERE IngredientId=@iid AND BrandId=@bid ORDER BY PurchaseDate DESC LIMIT 5) sub",
                [P("@iid",iid),P("@bid",req.BrandId)], ct);
            if (a.Count>0&&a[0]["avg"]!=null){var avg=Convert.ToDecimal(a[0]["avg"]);if(avg>0){var d=((req.ActualPrice??0)-avg)/avg;pt=d<=-0.1m?"مخفض":d>=0.1m?"غالي":"عادي";}}
        }
        await E("UPDATE ShoppingListItems SET IsPurchased=1,ActualCost=@ac,ActualPrice=@ap,PriceType=@pt,Store=@st,BrandId=COALESCE(@bid,BrandId) WHERE Id=@id",
            [P("@id",itemId),P("@ac",cost),P("@ap",req.ActualPrice??0),P("@pt",pt),P("@st",req.Store),P("@bid",req.BrandId)], ct);
        await E("INSERT INTO IngredientPrices (Id,IngredientId,BrandId,Price,Quantity,Unit,PriceType,Store) VALUES(@id,@iid,@bid,@p,@q,'unit',@pt,@st)",
            [P("@id",NewId()),P("@iid",iid),P("@bid",req.BrandId),P("@p",req.ActualPrice??0),P("@q",qty),P("@pt",pt),P("@st",req.Store)], ct);
        await E("UPDATE Ingredients SET CurrentStock=CurrentStock+@q WHERE Id=@iid",[P("@iid",iid),P("@q",qty)], ct);
        var lid = items[0]["shoppingListId"]?.ToString()??"";
        await E("UPDATE ShoppingLists SET TotalActualCost=(SELECT COALESCE(SUM(ActualCost),0) FROM ShoppingListItems WHERE ShoppingListId=@lid AND IsPurchased=1) WHERE Id=@lid",Ps("@lid",lid), ct);
        return Ok(new { itemId, priceType = pt, actualCost = cost });
    }

    // ═══ HELPERS ══════════════════════════════════════════════════════

    static string NewId() => Guid.NewGuid().ToString();
    static DateTime StartOfWeek(DateTime dt) { int diff = ((int)dt.DayOfWeek + 1) % 7; return dt.AddDays(-diff).Date; }
    static NpgsqlParameter P(string name, object? val) => new(name, val ?? DBNull.Value);
    static List<NpgsqlParameter> Ps(string n, object? v) => [P(n, v)];

    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
        try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct); var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct)) { var row = new Dictionary<string, object?>(); for (int i = 0; i < r.FieldCount; i++) row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i); rows.Add(row); } return rows;
        } finally { if (!w) await conn.CloseAsync(); }
    }

    private async Task<int> E(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection(); var w = conn.State == System.Data.ConnectionState.Open; if (!w) await conn.OpenAsync(ct);
        try { using var cmd = conn.CreateCommand(); cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p); return await cmd.ExecuteNonQueryAsync(ct);
        } finally { if (!w) await conn.CloseAsync(); }
    }
}

// DTOs
public class DishReq { public string? Name{get;set;} public string? Description{get;set;} public string? ImageUrl{get;set;} public string? ImageData{get;set;} public string? Category{get;set;} public int? PrepTime{get;set;} public int? Calories{get;set;} public int? Servings{get;set;} public List<DishIngLine>? Ingredients{get;set;} }
public class DishIngLine { public string? IngredientId{get;set;} public string? Name{get;set;} public decimal? Quantity{get;set;} public string? Unit{get;set;} }
public class MealReq2 { public string? Name{get;set;} public string? MealTime{get;set;} public string? Frequency{get;set;} public List<int>? PreferredDays{get;set;} public bool? IsDailyFavorite{get;set;} public bool? IsForGuests{get;set;} public List<string>? DishIds{get;set;} }
public class AddDishReq { public string? DishId{get;set;} }
public class PlanReq { public DateTime Date{get;set;} public string? BreakfastMealId{get;set;} public string? LunchMealId{get;set;} public string? DinnerMealId{get;set;} public string? SnackMealId{get;set;} }
public class IngredientReq { public string? Name{get;set;} public string? Category{get;set;} public string? Unit{get;set;} public decimal? CurrentStock{get;set;} public decimal? MinStock{get;set;} }
public class BrandReq { public string? BrandName{get;set;} public string? Quality{get;set;} public string? Notes{get;set;} public bool? IsPreferred{get;set;} }
public class PriceReq { public string? BrandId{get;set;} public decimal? Price{get;set;} public decimal? Quantity{get;set;} public string? Unit{get;set;} public string? Store{get;set;} public string? Notes{get;set;} }
public class PurchaseReq { public string? BrandId{get;set;} public decimal? ActualPrice{get;set;} public decimal? Quantity{get;set;} public string? Store{get;set;} }
