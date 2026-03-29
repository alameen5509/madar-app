using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Madar.API.Controllers;

[Authorize]
[ApiController]
[Route("api/historical-events")]
public class HistoricalEventsController : ControllerBase
{
    private readonly MadarDbContext _db;
    public HistoricalEventsController(MadarDbContext db) => _db = db;
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category, CancellationToken ct)
    {
        var sql = "SELECT * FROM HistoricalEvents WHERE UserId=@uid";
        var ps = new List<MySqlParameter> { new("@uid", Uid) };
        if (!string.IsNullOrEmpty(category)) { sql += " AND Category=@c"; ps.Add(new("@c", category)); }
        sql += " ORDER BY OrderIndex ASC, CreatedAt ASC";
        return Ok(await Query(sql, ps, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOne(Guid id, CancellationToken ct)
    {
        var rows = await Query("SELECT * FROM HistoricalEvents WHERE Id=@id AND UserId=@uid",
            [new("@id", id.ToString()), new("@uid", Uid)], ct);
        return rows.Count > 0 ? Ok(rows[0]) : NotFound();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] HistoricalEventReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        await Exec(@"INSERT INTO HistoricalEvents (Id,UserId,Title,GregorianDate,HijriDate,Location,Description,StrategicSignificance,OrderIndex,Category)
            VALUES(@id,@uid,@ti,@gd,@hd,@lo,@de,@ss,@oi,@ca)",
            [new("@id",id.ToString()),new("@uid",Uid),new("@ti",req.Title??""),
             new("@gd",(object?)req.GregorianDate??DBNull.Value),new("@hd",(object?)req.HijriDate??DBNull.Value),
             new("@lo",(object?)req.Location??DBNull.Value),new("@de",(object?)req.Description??DBNull.Value),
             new("@ss",(object?)req.StrategicSignificance??DBNull.Value),
             new("@oi",req.OrderIndex??0),new("@ca",req.Category??"")], ct);
        return Ok(new { id, title = req.Title });
    }

    [HttpPost("batch")]
    public async Task<IActionResult> CreateBatch([FromBody] List<HistoricalEventReq> events, CancellationToken ct)
    {
        var ids = new List<object>();
        foreach (var req in events)
        {
            var id = Guid.NewGuid();
            await Exec(@"INSERT INTO HistoricalEvents (Id,UserId,Title,GregorianDate,HijriDate,Location,Description,StrategicSignificance,OrderIndex,Category)
                VALUES(@id,@uid,@ti,@gd,@hd,@lo,@de,@ss,@oi,@ca)",
                [new("@id",id.ToString()),new("@uid",Uid),new("@ti",req.Title??""),
                 new("@gd",(object?)req.GregorianDate??DBNull.Value),new("@hd",(object?)req.HijriDate??DBNull.Value),
                 new("@lo",(object?)req.Location??DBNull.Value),new("@de",(object?)req.Description??DBNull.Value),
                 new("@ss",(object?)req.StrategicSignificance??DBNull.Value),
                 new("@oi",req.OrderIndex??0),new("@ca",req.Category??"")], ct);
            ids.Add(new { id, title = req.Title });
        }
        return Ok(new { count = ids.Count, events = ids });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] HistoricalEventReq req, CancellationToken ct)
    {
        var rows = await Exec(@"UPDATE HistoricalEvents SET Title=@ti,GregorianDate=@gd,HijriDate=@hd,Location=@lo,
            Description=@de,StrategicSignificance=@ss,OrderIndex=@oi,Category=@ca WHERE Id=@id AND UserId=@uid",
            [new("@id",id.ToString()),new("@uid",Uid),new("@ti",req.Title??""),
             new("@gd",(object?)req.GregorianDate??DBNull.Value),new("@hd",(object?)req.HijriDate??DBNull.Value),
             new("@lo",(object?)req.Location??DBNull.Value),new("@de",(object?)req.Description??DBNull.Value),
             new("@ss",(object?)req.StrategicSignificance??DBNull.Value),
             new("@oi",req.OrderIndex??0),new("@ca",req.Category??"")], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var rows = await Exec("DELETE FROM HistoricalEvents WHERE Id=@id AND UserId=@uid",
            [new("@id", id.ToString()), new("@uid", Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    [HttpPost("seed-ww1")]
    public async Task<IActionResult> SeedWW1(CancellationToken ct)
    {
        var events = new (string Title, string GDate, string HDate, string Location, string Desc, string Sig, int Order)[]
        {
            ("معركة فردان (أطول معارك الحرب)", "21 فبراير - 18 ديسمبر 1916 م", "17 ربيع الآخر - 23 صفر 1335 هـ",
             "مدينة فردان، الجبهة الغربية (شمال شرق فرنسا)",
             "شنت القيادة الألمانية هجوماً مدفعياً وبرياً مكثفاً ومستمراً على سلسلة الحصون الفرنسية المحيطة بمدينة فردان، بهدف دفع الجيش الفرنسي إلى نقطة الانهيار عبر \"استنزاف دمائه\". اتسمت المعركة بوحشية غير مسبوقة وتحولت إلى حرب خنادق واستنزاف طاحنة استمرت لما يقارب العشرة أشهر.",
             "رغم الخسائر البشرية المرعبة للطرفين، فشلت ألمانيا في تحقيق هدفها باختراق الجبهة أو إسقاط فرنسا. أصبحت فردان رمزاً للصلابة الدفاعية، ولكنها استنزفت الموارد العسكرية الألمانية بشكل خطير، وأضعفت قدرتها المستقبلية على المبادرة بالهجوم.", 7),

            ("معركة السوم (ظهور الدبابات الأول)", "1 يوليو - 18 نوفمبر 1916 م", "1 شعبان - 22 محرم 1335 هـ",
             "حوض نهر السوم، شمال فرنسا",
             "نفذت القوات البريطانية والفرنسية هجوماً واسع النطاق ضد الخطوط الألمانية لتخفيف الضغط الخانق عن جبهة فردان. شهد اليوم الأول من المعركة أكبر خسارة في تاريخ الجيش البريطاني، وفي هذه المعركة تم إدخال سلاح \"الدبابة\" لأول مرة في التاريخ العسكري لكسر جمود الخنادق.",
             "أثبتت المعركة أن قوات الحلفاء قادرة على تحمل حرب استنزاف طويلة الأمد. ورغم التقدم الجغرافي المحدود، أجبرت هذه المعركة الجيش الألماني لاحقاً على التراجع التكتيكي وإعادة التموضع، وبدأت موازين القوى تميل تدريجياً لصالح الحلفاء بفضل التفوق العددي والصناعي.", 8),

            ("انطلاق الثورة العربية الكبرى", "10 يونيو 1916 م", "9 شعبان 1334 هـ",
             "الحجاز وامتدت إلى بلاد الشام",
             "أعلن الشريف حسين بن علي الثورة المسلحة ضد الدولة العثمانية بدعم وتنسيق عسكري ولوجستي من بريطانيا. شملت العمليات العسكرية السيطرة على مكة، وتنفيذ حرب عصابات لتعطيل خط سكة حديد الحجاز، ومهاجمة الحاميات العسكرية العثمانية.",
             "نجحت في تشتيت جزء كبير من القوات العثمانية وإلزامها بالبقاء في الحجاز والشام لحماية خطوط الإمداد، مما خفف الضغط عن القوات البريطانية وسهّل تقدمها لاحقاً في فلسطين وسوريا، وشكلت بداية لتغيير الخارطة السياسية للشرق الأوسط.", 9),

            ("دخول الولايات المتحدة الأمريكية الحرب", "6 أبريل 1917 م", "14 جمادى الآخرة 1335 هـ",
             "واشنطن (صنع القرار) والتأثير على الجبهة الغربية والبحرية",
             "بعد سلسلة من التوترات، أبرزها استئناف ألمانيا لحرب الغواصات المفتوحة (التي استهدفت السفن التجارية الأمريكية) واعتراض المخابرات البريطانية لـ\"برقية زيمرمان\" (التي حاولت فيها ألمانيا تحريض المكسيك لشن حرب ضد أمريكا)، أعلن الرئيس الأمريكي وودرو ويلسون دخول بلاده الحرب ضد الإمبراطورية الألمانية.",
             "يُعد هذا الحدث نقطة التحول الأهم في الحرب؛ إذ وفر التدخل الأمريكي ضخاً هائلاً للقوات البشرية الطازجة، والإمدادات الصناعية، والقدرات المالية للحلفاء في وقت كانوا يعانون فيه من إنهاك شديد، مما رجّح كفة النصر نهائياً وأنهى الآمال الألمانية.", 10),

            ("الثورة البلشفية وخروج روسيا من الحرب (معاهدة بريست ليتوفسك)", "7 نوفمبر 1917 م (الثورة) - 3 مارس 1918 م (توقيع المعاهدة)", "21 محرم 1336 هـ - 19 جمادى الأولى 1336 هـ",
             "روسيا والجبهة الشرقية",
             "قاد فلاديمير لينين والبلاشفة ثورة أطاحت بالحكومة الروسية. وبسبب الانهيار الداخلي والرفض الشعبي الواسع للحرب، سارعت الحكومة السوفيتية الجديدة لتوقيع معاهدة سلام منفصلة مع ألمانيا (بريست ليتوفسك)، متنازلة بموجبها عن مساحات شاسعة من الأراضي والموارد.",
             "أدى خروج روسيا إلى إغلاق الجبهة الشرقية بالكامل، مما منح ألمانيا فرصة ذهبية لنقل عشرات الفرق العسكرية إلى الجبهة الغربية لشن هجوم حاسم ومحاولة كسب الحرب قبل وصول القوات الأمريكية بأعداد كبيرة.", 11),

            ("هجوم الربيع الألماني (هجوم لودندورف)", "21 مارس - 18 يوليو 1918 م", "8 جمادى الآخرة - 9 شوال 1336 هـ",
             "الجبهة الغربية (فرنسا وبلجيكا)",
             "شنت القوات الألمانية سلسلة من الهجمات المكثفة والمباغتة مستخدمة تكتيكات \"قوات الصدمة\" لكسر خطوط الحلفاء وإنهاء الحرب. حقق الهجوم في أسابيعه الأولى تقدماً عميقاً وغير مسبوق منذ عام 1914، وكاد أن يفصل بين القوات البريطانية والفرنسية.",
             "رغم النجاح التكتيكي والتقدم الجغرافي، استُنزفت قوات النخبة الألمانية، وتمددت خطوط إمدادها بشكل مفرط أدى لضعفها. شكّل فشل هذا الهجوم في تحقيق نصر استراتيجي قاضٍ نقطة اللاعودة، وبداية النهاية للقدرة الهجومية للإمبراطورية الألمانية.", 12),

            ("هجوم المائة يوم (الهجوم المضاد الشامل للحلفاء)", "8 أغسطس - 11 نوفمبر 1918 م", "30 شوال - 6 صفر 1337 هـ",
             "الجبهة الغربية (بدءاً من معركة أميان)",
             "شن الحلفاء (بقيادة بريطانية وفرنسية وبدعم أمريكي كثيف) سلسلة من الهجمات المنسقة. استخدم الحلفاء تكتيكات الأسلحة المشتركة (تنسيق المشاة، الدبابات، الطيران، والمدفعية) لخرق الدفاعات الألمانية الحصينة (مثل خط هيندنبيرغ) وإجبار الجيش الألماني على تراجع مستمر لا توقف فيه.",
             "أدى هذا الهجوم الماحق إلى انهيار الروح المعنوية والقدرة العسكرية للجيش الألماني. أدركت القيادة العليا الألمانية حتمية الهزيمة، وتزامن ذلك مع الانهيار الداخلي واستسلام حلفاء ألمانيا (بلغاريا، الدولة العثمانية، ثم النمسا والمجر) واحداً تلو الآخر.", 13),

            ("توقيع هدنة كومبيان وانتهاء العمليات العسكرية", "11 نوفمبر 1918 م (دخلت حيز التنفيذ الساعة 11 صباحاً)", "6 صفر 1337 هـ",
             "غابة كومبيان، فرنسا (داخل عربة قطار)",
             "في أعقاب تمرد عسكري داخلي أدى إلى تنازل القيصر الألماني \"فيلهلم الثاني\" عن العرش وإعلان الجمهورية، وقّع الوفد الألماني على اتفاقية هدنة قاسية مع الحلفاء تنص على الوقف الفوري لإطلاق النار، والانسحاب من الأراضي المحتلة، وتسليم العتاد العسكري الثقيل.",
             "أنهت هذه الهدنة أربع سنوات من النزاع الدموي المدمّر، ومثّلت السقوط الفعلي للإمبراطوريات العظمى (الألمانية، الروسية، العثمانية، النمساوية المجرية). كما مهدت الطريق لمؤتمر باريس ومعاهدة فرساي (1919) التي أعادت رسم خريطة العالم وأسست لواقع جيوسياسي جديد.", 14),
        };

        int count = 0;
        foreach (var e in events)
        {
            var check = await Query("SELECT Id FROM HistoricalEvents WHERE UserId=@uid AND OrderIndex=@oi AND Category='الحرب العالمية الأولى' LIMIT 1",
                [new("@uid", Uid), new("@oi", e.Order)], ct);
            if (check.Count > 0) continue;

            await Exec(@"INSERT INTO HistoricalEvents (Id,UserId,Title,GregorianDate,HijriDate,Location,Description,StrategicSignificance,OrderIndex,Category)
                VALUES(@id,@uid,@ti,@gd,@hd,@lo,@de,@ss,@oi,@ca)",
                [new("@id",Guid.NewGuid().ToString()),new("@uid",Uid),new("@ti",e.Title),
                 new("@gd",e.GDate),new("@hd",e.HDate),new("@lo",e.Location),
                 new("@de",e.Desc),new("@ss",e.Sig),new("@oi",e.Order),
                 new("@ca","الحرب العالمية الأولى")], ct);
            count++;
        }
        return Ok(new { message = $"تم إدخال {count} أحداث جديدة", count });
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories(CancellationToken ct)
    {
        return Ok(await Query("SELECT DISTINCT Category FROM HistoricalEvents WHERE UserId=@uid AND Category!='' ORDER BY Category",
            [new("@uid", Uid)], ct));
    }

    // ─── Helpers ────────────────────────────────────────────────────────
    private async Task<List<Dictionary<string, object?>>> Query(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in ps) cmd.Parameters.Add(p);
            using var r = await cmd.ExecuteReaderAsync(ct);
            var rows = new List<Dictionary<string, object?>>();
            while (await r.ReadAsync(ct))
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < r.FieldCount; i++)
                    row[char.ToLowerInvariant(r.GetName(i)[0]) + r.GetName(i)[1..]] = r.IsDBNull(i) ? null : r.GetValue(i);
                rows.Add(row);
            }
            return rows;
        }
        finally { if (!wasOpen) await conn.CloseAsync(); }
    }

    private async Task<int> Exec(string sql, List<MySqlParameter> ps, CancellationToken ct)
    {
        var conn = _db.Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(ct);
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var p in ps) cmd.Parameters.Add(p);
            return await cmd.ExecuteNonQueryAsync(ct);
        }
        finally { if (!wasOpen) await conn.CloseAsync(); }
    }
}

public class HistoricalEventReq
{
    public string? Title { get; set; }
    public string? GregorianDate { get; set; }
    public string? HijriDate { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? StrategicSignificance { get; set; }
    public int? OrderIndex { get; set; }
    public string? Category { get; set; }
}
