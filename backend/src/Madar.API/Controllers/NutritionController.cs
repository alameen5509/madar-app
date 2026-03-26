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

    // ═══ MEALS ═══════════════════════════════════════════════════════════

    [HttpGet("meals")]
    public async Task<IActionResult> GetMeals(CancellationToken ct) =>
        Ok(await Q("SELECT * FROM Meals WHERE UserId=@uid ORDER BY Name", [new("@uid", Uid)], ct));

    [HttpPost("meals")]
    public async Task<IActionResult> CreateMeal([FromBody] MealReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO Meals (Id,UserId,Name,Description,ImageUrl,MealType,PrepTime,Calories,Servings)
            VALUES(@id,@uid,@n,@d,@img,@mt,@pt,@cal,@srv)",
            [new("@id",id),new("@uid",Uid),new("@n",req.Name??""),new("@d",(object?)req.Description??DBNull.Value),
             new("@img",(object?)req.ImageUrl??DBNull.Value),new("@mt",req.MealType??"lunch"),
             new("@pt",(object?)req.PrepTime??DBNull.Value),new("@cal",(object?)req.Calories??DBNull.Value),
             new("@srv",req.Servings??4)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpGet("meals/{id}")]
    public async Task<IActionResult> GetMeal(string id, CancellationToken ct)
    {
        var meal = await Q("SELECT * FROM Meals WHERE Id=@id AND UserId=@uid", [new("@id",id),new("@uid",Uid)], ct);
        if (meal.Count == 0) return NotFound();
        var ingredients = await Q(@"SELECT mi.*, i.Name as IngredientName, i.Category
            FROM MealIngredients mi JOIN Ingredients i ON mi.IngredientId=i.Id
            WHERE mi.MealId=@mid", [new("@mid",id)], ct);
        var result = meal[0];
        result["ingredients"] = ingredients;
        return Ok(result);
    }

    [HttpPut("meals/{id}")]
    public async Task<IActionResult> UpdateMeal(string id, [FromBody] MealReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE Meals SET Name=COALESCE(@n,Name),Description=COALESCE(@d,Description),
            ImageUrl=COALESCE(@img,ImageUrl),MealType=COALESCE(@mt,MealType),
            PrepTime=COALESCE(@pt,PrepTime),Calories=COALESCE(@cal,Calories),Servings=COALESCE(@srv,Servings)
            WHERE Id=@id AND UserId=@uid",
            [new("@id",id),new("@uid",Uid),new("@n",(object?)req.Name??DBNull.Value),
             new("@d",(object?)req.Description??DBNull.Value),new("@img",(object?)req.ImageUrl??DBNull.Value),
             new("@mt",(object?)req.MealType??DBNull.Value),new("@pt",(object?)req.PrepTime??DBNull.Value),
             new("@cal",(object?)req.Calories??DBNull.Value),new("@srv",(object?)req.Servings??DBNull.Value)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("meals/{id}")]
    public async Task<IActionResult> DeleteMeal(string id, CancellationToken ct)
    {
        await E("DELETE FROM MealIngredients WHERE MealId=@id", [new("@id",id)], ct);
        var rows = await E("DELETE FROM Meals WHERE Id=@id AND UserId=@uid", [new("@id",id),new("@uid",Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    [HttpPost("meals/{mealId}/ingredients")]
    public async Task<IActionResult> AddMealIngredient(string mealId, [FromBody] MealIngReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO MealIngredients (Id,MealId,IngredientId,Quantity,Unit)
            VALUES(@id,@mid,@iid,@q,@u)",
            [new("@id",id),new("@mid",mealId),new("@iid",req.IngredientId??""),
             new("@q",req.Quantity??1),new("@u",req.Unit??"كيلو")], ct);
        return Ok(new { id });
    }

    // ═══ INGREDIENTS ═════════════════════════════════════════════════════

    [HttpGet("ingredients")]
    public async Task<IActionResult> GetIngredients(CancellationToken ct)
    {
        var items = await Q("SELECT * FROM Ingredients WHERE UserId=@uid ORDER BY Category, Name", [new("@uid", Uid)], ct);
        // Attach brands + last price for each
        foreach (var item in items)
        {
            var iid = item["id"]?.ToString() ?? "";
            var brands = await Q(@"SELECT ib.*, (SELECT Price FROM IngredientPrices WHERE BrandId=ib.Id ORDER BY PurchaseDate DESC LIMIT 1) as LastPrice,
                (SELECT AVG(Price) FROM (SELECT Price FROM IngredientPrices WHERE BrandId=ib.Id ORDER BY PurchaseDate DESC LIMIT 5) sub) as AvgPrice
                FROM IngredientBrands ib WHERE ib.IngredientId=@iid AND ib.IsActive=1 ORDER BY ib.IsPreferred DESC, ib.BrandName",
                [new("@iid", iid)], ct);
            item["brands"] = brands;
        }
        return Ok(items);
    }

    [HttpPost("ingredients")]
    public async Task<IActionResult> CreateIngredient([FromBody] IngredientReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO Ingredients (Id,UserId,Name,Category,Unit,CurrentStock,MinStock)
            VALUES(@id,@uid,@n,@cat,@u,@cs,@ms)",
            [new("@id",id),new("@uid",Uid),new("@n",req.Name??""),new("@cat",req.Category??"بقالة"),
             new("@u",req.Unit??"كيلو"),new("@cs",req.CurrentStock??0),new("@ms",req.MinStock??0)], ct);
        return Ok(new { id, name = req.Name });
    }

    [HttpPut("ingredients/{id}")]
    public async Task<IActionResult> UpdateIngredient(string id, [FromBody] IngredientReq req, CancellationToken ct)
    {
        var rows = await E(@"UPDATE Ingredients SET Name=COALESCE(@n,Name),Category=COALESCE(@cat,Category),
            Unit=COALESCE(@u,Unit),CurrentStock=COALESCE(@cs,CurrentStock),MinStock=COALESCE(@ms,MinStock)
            WHERE Id=@id AND UserId=@uid",
            [new("@id",id),new("@uid",Uid),new("@n",(object?)req.Name??DBNull.Value),
             new("@cat",(object?)req.Category??DBNull.Value),new("@u",(object?)req.Unit??DBNull.Value),
             new("@cs",(object?)req.CurrentStock??DBNull.Value),new("@ms",(object?)req.MinStock??DBNull.Value)], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    // ═══ BRANDS ══════════════════════════════════════════════════════════

    [HttpPost("ingredients/{ingredientId}/brands")]
    public async Task<IActionResult> AddBrand(string ingredientId, [FromBody] BrandReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO IngredientBrands (Id,IngredientId,BrandName,Quality,Notes,IsPreferred)
            VALUES(@id,@iid,@bn,@q,@n,@pref)",
            [new("@id",id),new("@iid",ingredientId),new("@bn",req.BrandName??""),
             new("@q",req.Quality??"جيدة"),new("@n",(object?)req.Notes??DBNull.Value),
             new("@pref",req.IsPreferred??false)], ct);
        return Ok(new { id, brandName = req.BrandName });
    }

    // ═══ PRICES ══════════════════════════════════════════════════════════

    [HttpGet("ingredients/{ingredientId}/price-history")]
    public async Task<IActionResult> GetPriceHistory(string ingredientId, CancellationToken ct)
    {
        var rows = await Q(@"SELECT ip.*, ib.BrandName FROM IngredientPrices ip
            LEFT JOIN IngredientBrands ib ON ip.BrandId=ib.Id
            WHERE ip.IngredientId=@iid ORDER BY ip.PurchaseDate DESC LIMIT 50",
            [new("@iid", ingredientId)], ct);
        return Ok(rows);
    }

    [HttpPost("ingredients/{ingredientId}/prices")]
    public async Task<IActionResult> RecordPrice(string ingredientId, [FromBody] PriceReq req, CancellationToken ct)
    {
        // Calculate price type based on avg of last 5
        var priceType = "عادي";
        if (req.BrandId != null)
        {
            var avgRows = await Q(@"SELECT AVG(Price) as avg FROM (
                SELECT Price FROM IngredientPrices WHERE IngredientId=@iid AND BrandId=@bid
                ORDER BY PurchaseDate DESC LIMIT 5) sub",
                [new("@iid", ingredientId), new("@bid", req.BrandId)], ct);
            if (avgRows.Count > 0 && avgRows[0]["avg"] != null)
            {
                var avg = Convert.ToDecimal(avgRows[0]["avg"]);
                if (avg > 0)
                {
                    var diff = ((req.Price ?? 0) - avg) / avg;
                    priceType = diff <= -0.1m ? "مخفض" : diff >= 0.1m ? "غالي" : "عادي";
                }
            }
        }

        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO IngredientPrices (Id,IngredientId,BrandId,Price,Quantity,Unit,PriceType,Store,Notes)
            VALUES(@id,@iid,@bid,@p,@q,@u,@pt,@st,@n)",
            [new("@id",id),new("@iid",ingredientId),new("@bid",(object?)req.BrandId??DBNull.Value),
             new("@p",req.Price??0),new("@q",req.Quantity??1),new("@u",req.Unit??"كيلو"),
             new("@pt",priceType),new("@st",(object?)req.Store??DBNull.Value),
             new("@n",(object?)req.Notes??DBNull.Value)], ct);

        // Update stock
        if (req.Quantity > 0)
            await E("UPDATE Ingredients SET CurrentStock=CurrentStock+@q WHERE Id=@iid",
                [new("@iid",ingredientId),new("@q",req.Quantity??0)], ct);

        return Ok(new { id, priceType });
    }

    [HttpGet("ingredients/{ingredientId}/price-analysis")]
    public async Task<IActionResult> PriceAnalysis(string ingredientId, CancellationToken ct)
    {
        var brands = await Q(@"SELECT ib.Id, ib.BrandName, ib.Quality, ib.IsPreferred,
            (SELECT AVG(Price) FROM (SELECT Price FROM IngredientPrices WHERE BrandId=ib.Id ORDER BY PurchaseDate DESC LIMIT 5) s) as AvgPrice,
            (SELECT MIN(Price) FROM IngredientPrices WHERE BrandId=ib.Id) as MinPrice,
            (SELECT MAX(Price) FROM IngredientPrices WHERE BrandId=ib.Id) as MaxPrice,
            (SELECT COUNT(*) FROM IngredientPrices WHERE BrandId=ib.Id) as PurchaseCount
            FROM IngredientBrands ib WHERE ib.IngredientId=@iid AND ib.IsActive=1",
            [new("@iid", ingredientId)], ct);
        var stores = await Q(@"SELECT Store, AVG(Price) as AvgPrice, COUNT(*) as Count
            FROM IngredientPrices WHERE IngredientId=@iid AND Store IS NOT NULL
            GROUP BY Store ORDER BY AvgPrice",
            [new("@iid", ingredientId)], ct);
        return Ok(new { brands, stores });
    }

    // ═══ MEAL PLANS ══════════════════════════════════════════════════════

    [HttpGet("meal-plans")]
    public async Task<IActionResult> GetMealPlans([FromQuery] string? weekStart, CancellationToken ct)
    {
        var start = weekStart != null ? DateTime.Parse(weekStart) : DateTime.UtcNow.Date;
        var end = start.AddDays(7);
        var plans = await Q(@"SELECT mp.*,
            bm.Name as BreakfastName, lm.Name as LunchName, dm.Name as DinnerName,
            s1.Name as Snack1Name, s2.Name as Snack2Name
            FROM MealPlans mp
            LEFT JOIN Meals bm ON mp.BreakfastMealId=bm.Id
            LEFT JOIN Meals lm ON mp.LunchMealId=lm.Id
            LEFT JOIN Meals dm ON mp.DinnerMealId=dm.Id
            LEFT JOIN Meals s1 ON mp.Snack1MealId=s1.Id
            LEFT JOIN Meals s2 ON mp.Snack2MealId=s2.Id
            WHERE mp.UserId=@uid AND mp.PlanDate>=@s AND mp.PlanDate<@e ORDER BY mp.PlanDate",
            [new("@uid",Uid),new("@s",start),new("@e",end)], ct);
        return Ok(plans);
    }

    [HttpPost("meal-plans")]
    public async Task<IActionResult> SetMealPlan([FromBody] MealPlanReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        await E(@"INSERT INTO MealPlans (Id,UserId,PlanDate,BreakfastMealId,LunchMealId,DinnerMealId,Snack1MealId,Snack2MealId,IsAutoGenerated)
            VALUES(@id,@uid,@d,@b,@l,@dn,@s1,@s2,0)
            ON DUPLICATE KEY UPDATE BreakfastMealId=VALUES(BreakfastMealId),LunchMealId=VALUES(LunchMealId),
            DinnerMealId=VALUES(DinnerMealId),Snack1MealId=VALUES(Snack1MealId),Snack2MealId=VALUES(Snack2MealId)",
            [new("@id",id),new("@uid",Uid),new("@d",req.Date),
             new("@b",(object?)req.BreakfastMealId??DBNull.Value),new("@l",(object?)req.LunchMealId??DBNull.Value),
             new("@dn",(object?)req.DinnerMealId??DBNull.Value),new("@s1",(object?)req.Snack1MealId??DBNull.Value),
             new("@s2",(object?)req.Snack2MealId??DBNull.Value)], ct);
        return Ok(new { id, date = req.Date });
    }

    // ═══ SHOPPING ════════════════════════════════════════════════════════

    [HttpPost("shopping/generate")]
    public async Task<IActionResult> GenerateShoppingList([FromQuery] string? weekStart, CancellationToken ct)
    {
        var start = weekStart != null ? DateTime.Parse(weekStart) : DateTime.UtcNow.Date;
        var end = start.AddDays(7);

        // Get all meal IDs for the week
        var plans = await Q(@"SELECT BreakfastMealId,LunchMealId,DinnerMealId,Snack1MealId,Snack2MealId
            FROM MealPlans WHERE UserId=@uid AND PlanDate>=@s AND PlanDate<@e",
            [new("@uid",Uid),new("@s",start),new("@e",end)], ct);

        var mealIds = plans.SelectMany(p => new[] { p["breakfastMealId"], p["lunchMealId"], p["dinnerMealId"], p["snack1MealId"], p["snack2MealId"] })
            .Where(x => x != null).Select(x => x!.ToString()!).Distinct().ToList();

        if (mealIds.Count == 0) return Ok(new { id = (string?)null, items = Array.Empty<object>(), message = "لا توجد وجبات مخططة" });

        // Aggregate ingredients
        var placeholders = string.Join(",", mealIds.Select((_, i) => $"@m{i}"));
        var ps = mealIds.Select((m, i) => new MySqlParameter($"@m{i}", m)).ToList();
        var ingredients = await Q($@"SELECT mi.IngredientId, i.Name, i.Unit, i.CurrentStock, SUM(mi.Quantity) as TotalNeeded,
            (SELECT ib.Id FROM IngredientBrands ib WHERE ib.IngredientId=mi.IngredientId AND ib.IsPreferred=1 LIMIT 1) as PreferredBrandId,
            (SELECT ib.BrandName FROM IngredientBrands ib WHERE ib.IngredientId=mi.IngredientId AND ib.IsPreferred=1 LIMIT 1) as PreferredBrand,
            (SELECT ip.Price FROM IngredientPrices ip WHERE ip.IngredientId=mi.IngredientId ORDER BY ip.PurchaseDate DESC LIMIT 1) as LastPrice
            FROM MealIngredients mi JOIN Ingredients i ON mi.IngredientId=i.Id
            WHERE mi.MealId IN ({placeholders}) GROUP BY mi.IngredientId, i.Name, i.Unit, i.CurrentStock",
            ps, ct);

        // Create shopping list
        var listId = Guid.NewGuid().ToString();
        decimal totalEst = 0;
        await E("INSERT INTO ShoppingLists (Id,UserId,Status) VALUES(@id,@uid,'pending')",
            [new("@id",listId),new("@uid",Uid)], ct);

        foreach (var ing in ingredients)
        {
            var needed = Convert.ToDecimal(ing["totalNeeded"] ?? 0);
            var stock = Convert.ToDecimal(ing["currentStock"] ?? 0);
            var toBuy = Math.Max(0, needed - stock);
            var lastPrice = ing["lastPrice"] != null ? Convert.ToDecimal(ing["lastPrice"]) : 0;
            var est = toBuy * lastPrice;
            totalEst += est;

            await E(@"INSERT INTO ShoppingListItems (Id,ShoppingListId,IngredientId,BrandId,RequiredQuantity,CurrentStock,ToBuyQuantity,EstimatedCost)
                VALUES(@id,@lid,@iid,@bid,@rq,@cs,@tb,@ec)",
                [new("@id",Guid.NewGuid().ToString()),new("@lid",listId),new("@iid",ing["ingredientId"]?.ToString()??""),
                 new("@bid",(object?)ing["preferredBrandId"]??DBNull.Value),
                 new("@rq",needed),new("@cs",stock),new("@tb",toBuy),new("@ec",est)], ct);
        }

        await E("UPDATE ShoppingLists SET TotalEstimatedCost=@c WHERE Id=@id", [new("@id",listId),new("@c",totalEst)], ct);

        return Ok(new { id = listId, totalEstimatedCost = totalEst, itemCount = ingredients.Count });
    }

    [HttpGet("shopping/{listId}")]
    public async Task<IActionResult> GetShoppingList(string listId, CancellationToken ct)
    {
        var list = await Q("SELECT * FROM ShoppingLists WHERE Id=@id AND UserId=@uid", [new("@id",listId),new("@uid",Uid)], ct);
        if (list.Count == 0) return NotFound();
        var items = await Q(@"SELECT si.*, i.Name as IngredientName, i.Unit as IngredientUnit, i.Category,
            ib.BrandName as PreferredBrand
            FROM ShoppingListItems si
            JOIN Ingredients i ON si.IngredientId=i.Id
            LEFT JOIN IngredientBrands ib ON si.BrandId=ib.Id
            WHERE si.ShoppingListId=@lid ORDER BY i.Category, i.Name",
            [new("@lid",listId)], ct);
        var result = list[0];
        result["items"] = items;
        return Ok(result);
    }

    [HttpPatch("shopping/items/{itemId}/purchase")]
    public async Task<IActionResult> PurchaseItem(string itemId, [FromBody] PurchaseReq req, CancellationToken ct)
    {
        // Get item details
        var items = await Q("SELECT si.*, sl.UserId FROM ShoppingListItems si JOIN ShoppingLists sl ON si.ShoppingListId=sl.Id WHERE si.Id=@id",
            [new("@id",itemId)], ct);
        if (items.Count == 0) return NotFound();
        var item = items[0];
        if (item["userId"]?.ToString() != Uid) return Forbid();

        var ingredientId = item["ingredientId"]?.ToString() ?? "";
        var actualCost = (req.ActualPrice ?? 0) * (req.Quantity ?? Convert.ToDecimal(item["toBuyQuantity"] ?? 0));

        // Calculate price type
        var priceType = "عادي";
        if (req.BrandId != null)
        {
            var avgRows = await Q(@"SELECT AVG(Price) as avg FROM (
                SELECT Price FROM IngredientPrices WHERE IngredientId=@iid AND BrandId=@bid
                ORDER BY PurchaseDate DESC LIMIT 5) sub",
                [new("@iid",ingredientId),new("@bid",req.BrandId)], ct);
            if (avgRows.Count > 0 && avgRows[0]["avg"] != null)
            {
                var avg = Convert.ToDecimal(avgRows[0]["avg"]);
                if (avg > 0) { var d = ((req.ActualPrice ?? 0) - avg) / avg; priceType = d <= -0.1m ? "مخفض" : d >= 0.1m ? "غالي" : "عادي"; }
            }
        }

        // Update item
        await E(@"UPDATE ShoppingListItems SET IsPurchased=1, ActualCost=@ac, ActualPrice=@ap,
            PriceType=@pt, Store=@st, BrandId=COALESCE(@bid,BrandId) WHERE Id=@id",
            [new("@id",itemId),new("@ac",actualCost),new("@ap",req.ActualPrice??0),
             new("@pt",priceType),new("@st",(object?)req.Store??DBNull.Value),
             new("@bid",(object?)req.BrandId??DBNull.Value)], ct);

        // Record price history
        await E(@"INSERT INTO IngredientPrices (Id,IngredientId,BrandId,Price,Quantity,Unit,PriceType,Store)
            VALUES(@id,@iid,@bid,@p,@q,'unit',@pt,@st)",
            [new("@id",Guid.NewGuid().ToString()),new("@iid",ingredientId),
             new("@bid",(object?)req.BrandId??DBNull.Value),new("@p",req.ActualPrice??0),
             new("@q",req.Quantity??1),new("@pt",priceType),new("@st",(object?)req.Store??DBNull.Value)], ct);

        // Update ingredient stock
        await E("UPDATE Ingredients SET CurrentStock=CurrentStock+@q WHERE Id=@iid",
            [new("@iid",ingredientId),new("@q",req.Quantity??Convert.ToDecimal(item["toBuyQuantity"]??0))], ct);

        // Update shopping list total
        await E(@"UPDATE ShoppingLists SET TotalActualCost=(SELECT COALESCE(SUM(ActualCost),0) FROM ShoppingListItems WHERE ShoppingListId=@lid AND IsPurchased=1)
            WHERE Id=@lid", [new("@lid",item["shoppingListId"]?.ToString()??"")], ct);

        return Ok(new { itemId, priceType, actualCost });
    }

    // ═══ HELPERS ══════════════════════════════════════════════════════════

    private async Task<List<Dictionary<string, object?>>> Q(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct);
            var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct)) {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < r.FieldCount; i++)
                    row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i);
                rows.Add(row);
            }
            return rows;
        } finally { if (!wasOpen) await conn.CloseAsync(); }
    }

    private async Task<int> E(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql; foreach (var p in ps) cmd.Parameters.Add(p);
            return await cmd.ExecuteNonQueryAsync(ct);
        } finally { if (!wasOpen) await conn.CloseAsync(); }
    }
}

// DTOs
public class MealReq { public string? Name{get;set;} public string? Description{get;set;} public string? ImageUrl{get;set;} public string? MealType{get;set;} public int? PrepTime{get;set;} public int? Calories{get;set;} public int? Servings{get;set;} }
public class MealIngReq { public string? IngredientId{get;set;} public decimal? Quantity{get;set;} public string? Unit{get;set;} }
public class IngredientReq { public string? Name{get;set;} public string? Category{get;set;} public string? Unit{get;set;} public decimal? CurrentStock{get;set;} public decimal? MinStock{get;set;} }
public class BrandReq { public string? BrandName{get;set;} public string? Quality{get;set;} public string? Notes{get;set;} public bool? IsPreferred{get;set;} }
public class PriceReq { public string? BrandId{get;set;} public decimal? Price{get;set;} public decimal? Quantity{get;set;} public string? Unit{get;set;} public string? Store{get;set;} public string? Notes{get;set;} }
public class MealPlanReq { public DateTime Date{get;set;} public string? BreakfastMealId{get;set;} public string? LunchMealId{get;set;} public string? DinnerMealId{get;set;} public string? Snack1MealId{get;set;} public string? Snack2MealId{get;set;} }
public class PurchaseReq { public string? BrandId{get;set;} public decimal? ActualPrice{get;set;} public decimal? Quantity{get;set;} public string? Store{get;set;} }
