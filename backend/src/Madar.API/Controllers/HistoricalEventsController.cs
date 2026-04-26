using System.Security.Claims;
using Madar.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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
        var sql = "SELECT * FROM \"HistoricalEvents\" WHERE \"UserId\"=@uid";
        var ps = new List<NpgsqlParameter> { P("@uid", Uid) };
        if (!string.IsNullOrEmpty(category)) { sql += " AND \"Category\"=@c"; ps.Add(P("@c", category)); }
        sql += " ORDER BY \"OrderIndex\" ASC, \"CreatedAt\" ASC";
        return Ok(await Query(sql, ps, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOne(Guid id, CancellationToken ct)
    {
        var rows = await Query("SELECT * FROM \"HistoricalEvents\" WHERE \"Id\"=@id AND \"UserId\"=@uid",
            [P("@id", id.ToString()), P("@uid", Uid)], ct);
        return rows.Count > 0 ? Ok(rows[0]) : NotFound();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] HistoricalEventReq req, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        await Exec(@"INSERT INTO ""HistoricalEvents"" (""Id"",""UserId"",""Title"",""GregorianDate"",""HijriDate"",""Location"",""Description"",""StrategicSignificance"",""OrderIndex"",""Category"")
            VALUES(@id,@uid,@ti,@gd,@hd,@lo,@de,@ss,@oi,@ca)",
            [P("@id",id.ToString()),P("@uid",Uid),P("@ti",req.Title??""),
             P("@gd",(object?)req.GregorianDate??DBNull.Value),P("@hd",(object?)req.HijriDate??DBNull.Value),
             P("@lo",(object?)req.Location??DBNull.Value),P("@de",(object?)req.Description??DBNull.Value),
             P("@ss",(object?)req.StrategicSignificance??DBNull.Value),
             P("@oi",req.OrderIndex??0),P("@ca",req.Category??"")], ct);
        return Ok(new { id, title = req.Title });
    }

    [HttpPost("batch")]
    public async Task<IActionResult> CreateBatch([FromBody] List<HistoricalEventReq> events, CancellationToken ct)
    {
        var ids = new List<object>();
        foreach (var req in events)
        {
            var id = Guid.NewGuid();
            await Exec(@"INSERT INTO ""HistoricalEvents"" (""Id"",""UserId"",""Title"",""GregorianDate"",""HijriDate"",""Location"",""Description"",""StrategicSignificance"",""OrderIndex"",""Category"")
                VALUES(@id,@uid,@ti,@gd,@hd,@lo,@de,@ss,@oi,@ca)",
                [P("@id",id.ToString()),P("@uid",Uid),P("@ti",req.Title??""),
                 P("@gd",(object?)req.GregorianDate??DBNull.Value),P("@hd",(object?)req.HijriDate??DBNull.Value),
                 P("@lo",(object?)req.Location??DBNull.Value),P("@de",(object?)req.Description??DBNull.Value),
                 P("@ss",(object?)req.StrategicSignificance??DBNull.Value),
                 P("@oi",req.OrderIndex??0),P("@ca",req.Category??"")], ct);
            ids.Add(new { id, title = req.Title });
        }
        return Ok(new { count = ids.Count, events = ids });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] HistoricalEventReq req, CancellationToken ct)
    {
        var rows = await Exec(@"UPDATE ""HistoricalEvents"" SET ""Title""=@ti,""GregorianDate""=@gd,""HijriDate""=@hd,""Location""=@lo,
            ""Description""=@de,""StrategicSignificance""=@ss,""OrderIndex""=@oi,""Category""=@ca WHERE ""Id""::text=@id AND ""UserId""::text=@uid",
            [P("@id",id.ToString()),P("@uid",Uid),P("@ti",req.Title??""),
             P("@gd",(object?)req.GregorianDate??DBNull.Value),P("@hd",(object?)req.HijriDate??DBNull.Value),
             P("@lo",(object?)req.Location??DBNull.Value),P("@de",(object?)req.Description??DBNull.Value),
             P("@ss",(object?)req.StrategicSignificance??DBNull.Value),
             P("@oi",req.OrderIndex??0),P("@ca",req.Category??"")], ct);
        return rows > 0 ? Ok(new { id }) : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var rows = await Exec("DELETE FROM \"HistoricalEvents\" WHERE \"Id\"=@id AND \"UserId\"=@uid",
            [P("@id", id.ToString()), P("@uid", Uid)], ct);
        return rows > 0 ? NoContent() : NotFound();
    }

    [HttpPost("seed-ww1")]
    public async Task<IActionResult> SeedWW1(CancellationToken ct)
    {
        var events = new (string Title, string GDate, string HDate, string Location, string Desc, string Sig, int Order)[]
        {
            ("اغتيال ولي عهد النمسا والمجر (فرانز فرديناند)", "28 يونيو 1914 م", "4 شعبان 1332 هـ", "سراييفو (البوسنة)",
             "قام طالب صربي قومي يُدعى \"غافريلو برينسيب\" باغتيال ولي عهد الإمبراطورية النمساوية المجرية وزوجته. كان هذا الحدث بمثابة الشرارة المباشرة التي أشعلت فتيل التوترات المتراكمة في أوروبا.",
             "أدى هذا الاغتيال إلى توجيه النمسا والمجر إنذاراً شديد اللهجة لصربيا، مما دفع التحالفات الأوروبية للتدخل وتصعيد الأزمة.", 1),
            ("إعلان النمسا والمجر الحرب على صربيا", "28 يوليو 1914 م", "5 رمضان 1332 هـ", "أوروبا الوسطى والبلقان",
             "بعد رفض صربيا لبعض شروط الإنذار النمساوي، أعلنت الإمبراطورية النمساوية المجرية الحرب عليها. وبدأت روسيا (حليفة صربيا) بالتعبئة العامة لجيوشها.",
             "تفعيل نظام \"التحالفات المتشابكة\" في أوروبا، مما جرّ دولاً أخرى إلى ساحة المعركة تباعاً.", 2),
            ("تفعيل \"خطة شليفن\" وغزو بلجيكا", "4 أغسطس 1914 م", "12 رمضان 1332 هـ", "بلجيكا وفرنسا",
             "أعلنت ألمانيا الحرب على روسيا وفرنسا. ولتجنب القتال على جبهتين، نفذت ألمانيا خطة لتوجيه ضربة سريعة لفرنسا عبر غزو بلجيكا (المحايدة) للوصول إلى باريس.",
             "أدى غزو بلجيكا إلى دفع بريطانيا لإعلان الحرب على ألمانيا فوراً، لتكتمل بذلك أطراف النزاع الرئيسية.", 3),
            ("معركة المارن الأولى (وقف التقدم الألماني)", "6 - 12 سبتمبر 1914 م", "16 - 22 شوال 1332 هـ", "حوض نهر المارن، فرنسا",
             "شنت القوات الفرنسية والبريطانية هجوماً مضاداً حاسماً ضد الجيش الألماني الذي كان يزحف بسرعة نحو العاصمة باريس، ونجحت في إيقاف تقدمه وإجباره على التراجع.",
             "فشل خطة \"شليفن\" الألمانية في تحقيق نصر سريع، وبداية تأسيس نظام \"حرب الخنادق\" الذي جمّد الجبهة الغربية لسنوات.", 4),
            ("دخول الدولة العثمانية الحرب العالمية الأولى", "29 أكتوبر 1914 م", "9 ذو الحجة 1332 هـ", "البحر الأسود والجبهات الشرقية",
             "قامت سفن حربية عثمانية (تحت قيادة ألمانية) بقصف موانئ روسية على سواحل البحر الأسود، مما أدخل الدولة العثمانية الحرب رسمياً إلى جانب ألمانيا والنمسا (دول المركز).",
             "إعلان روسيا وبريطانيا وفرنسا الحرب على الدولة العثمانية، مما وسّع نطاق الحرب لتشمل الشرق الأوسط وشمال أفريقيا، وفتح جبهات قتال جديدة.", 5),
            ("حملة جاليبولي (معارك مضيق الدردنيل)", "19 فبراير 1915 م (بداية الحملة)", "5 ربيع الآخر 1333 هـ", "شبه جزيرة جاليبولي (الدولة العثمانية)",
             "شنت بريطانيا وفرنسا هجوماً بحرياً وبرياً ضخماً للسيطرة على مضيق الدردنيل بهدف احتلال العاصمة العثمانية (إسطنبول) وفتح طريق إمداد بحري آمن إلى روسيا.",
             "صمود عثماني قوي وانتصار دفاعي كبير، أدى في النهاية إلى انسحاب قوات الحلفاء بعد أشهر من القتال الدامي وتكبدهم خسائر فادحة.", 6),
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

            ("مؤتمر باريس للسلام", "18 يناير 1919 م", "16 ربيع الآخر 1337 هـ",
             "باريس، فرنسا",
             "اجتمع قادة الدول المنتصرة (الحلفاء) لصياغة شروط السلام وفرضها على الدول المنهزمة (دول المركز). غابت عن المؤتمر الدول المهزومة وروسيا السوفيتية، وسيطر على القرارات ما عُرف بـ \"الأربعة الكبار\" (قادة بريطانيا، فرنسا، الولايات المتحدة، وإيطاليا).",
             "أسس هذا المؤتمر لنظام دولي جديد، وتمت فيه هندسة خريطة سياسية جديدة للعالم شملت تقسيم إمبراطوريات الوسط المنهزمة، وتوزيع مناطق النفوذ والانتداب (خاصة في الشرق الأوسط)، مما شكل جذوراً للعديد من الصراعات الجيوسياسية المعاصرة.", 15),

            ("توقيع معاهدة فرساي", "28 يونيو 1919 م", "29 رمضان 1337 هـ",
             "قصر فرساي، باريس",
             "المعاهدة الرئيسية التي أنهت حالة الحرب رسمياً بين ألمانيا والحلفاء. تضمنت شروطاً قاسية جداً ومذلة على ألمانيا، شملت التجريد العسكري الواسع، ودفع تعويضات مالية ضخمة جداً، واقتطاع أجزاء من أراضيها لصالح دول مجاورة، وتحميلها قانونياً المسؤولية الكاملة عن اندلاع الحرب.",
             "أدت هذه الشروط القاسية إلى انهيار الاقتصاد الألماني لاحقاً وتوليد شعور عميق بالإذلال القومي، مما خلق بيئة سياسية واجتماعية خصبة لظهور الحركات المتطرفة (مثل الحزب النازي) ومهد الطريق فعلياً لاندلاع الحرب العالمية الثانية.", 16),

            ("تأسيس عصبة الأمم", "10 يناير 1920 م", "18 ربيع الآخر 1338 هـ",
             "جنيف، سويسرا (المقر الرئيسي)",
             "منظمة دولية تأسست بناءً على المبادئ التي طرحها الرئيس الأمريكي \"وودرو ويلسون\"، بهدف الحفاظ على السلام العالمي، ومنع نشوب حروب مستقبلية عبر تفعيل الدبلوماسية، ونزع السلاح، وتطبيق مبدأ الأمن الجماعي لحل النزاعات بين الدول.",
             "كانت أول محاولة جادة ومؤسسية لتأسيس نظام أمن دولي يجمع دول العالم. ورغم فشلها لاحقاً في منع اندلاع الحرب العالمية الثانية (بسبب افتقارها لقوة عسكرية رادعة وانسحاب قوى كبرى منها)، إلا أنها وضعت الأساس القانوني والتنظيمي الذي بُنيت عليه منظمة \"الأمم المتحدة\" الحالية.", 17),

            ("معاهدة سيفر وتقسيم الدولة العثمانية", "10 أغسطس 1920 م", "25 ذو القعدة 1338 هـ",
             "سيفر، فرنسا",
             "معاهدة سلام فرضها الحلفاء على الدولة العثمانية، نصت على تخلي العثمانيين عن جميع أراضيهم غير الناطقة بالتركية (في بلاد الشام، العراق، وشبه الجزيرة العربية)، وتقسيم أجزاء واسعة من الأناضول بين الحلفاء، مع فرض نظام الانتداب (البريطاني والفرنسي) على الأراضي العربية.",
             "مثّلت النهاية الرسمية والتمزيق الفعلي للإمبراطورية العثمانية، وكرّست واقع اتفاقية (سايكس بيكو)، مما أسس للحدود السياسية الحديثة في الشرق الأوسط. كما أدت قسوة المعاهدة إلى اندلاع حرب الاستقلال التركية التي نجحت في إلغاء المعاهدة واستبدالها بمعاهدة لوزان (1923).", 18),

            ("تشريع نظام التجنيد الإجباري في بريطانيا", "17 مايو 1916 م", "14 رجب 1334 هـ (تقريباً)", "بريطانيا العظمى",
             "بعد أن كان الجيش البريطاني يعتمد كلياً على المتطوعين، وأمام تدفق المجندين غير الكافي لسد النقص الحاد، أقرت الحكومة البريطانية نظام التجنيد الإجباري لضمان توفير الجنود للقوات المسلحة.",
             "مثّل هذا تحولاً جذرياً سمح لبريطانيا بتكوين جيش موسع قادر على خوض حرب استنزاف طويلة الأمد ضد ألمانيا على الجبهة الغربية، وتعويض الخسائر الفادحة في المعارك الكبرى مثل معركة \"السوم\".", 19),
            ("بدء \"حرب الخنادق\" وإنشاء الأنظمة الدفاعية المعقدة", "خريف 1914 م", "أواخر 1332 هـ", "الجبهة الغربية (من ساحل القنال الإنجليزي حتى سويسرا)",
             "بعد فشل \"الحرب المتنقلة\" السريعة لكلا الطرفين، حفرت الجيوش الخنادق للاحتماء، فتحولت الأرض إلى شبكات معقدة من الخنادق المتوازية والمتقاطعة المدعمة بالأسلاك الشائكة والمخابئ العميقة المقاومة للمدفعية، تفصل بينها منطقة عازلة مميتة تُعرف بـ \"الأرض المحايدة\".",
             "أدى هذا التطور إلى تجميد خطوط القتال لسنوات وإلغاء فاعلية الهجمات التقليدية، مما أجبر الجيوش على البحث عن تكتيكات وأسلحة جديدة (كالغازات والدبابات والمدافع الرشاشة والخفيفة وقاذفات اللهب) لكسر هذا الجمود الذي استنزف طاقات الدول.", 20),
            ("هدنة \"عيد الميلاد\" غير الرسمية بين الجنود", "25 ديسمبر 1914 م", "7 صفر 1333 هـ", "\"الأرض المحايدة\" بين الخنادق المتقابلة على الجبهة الغربية",
             "في ظاهرة استثنائية، اتفق الجنود البريطانيون والألمان بشكل عفوي على وقف إطلاق النار، وخرجوا من خنادقهم ليتقابلوا في المنطقة المحايدة لتبادل التحيات، ودفن الموتى سوياً، ومقايضة الأطعمة، بل ولعبوا كرة القدم معاً.",
             "رغم أنها لم تؤثر على المسار العسكري للحرب واستمرت القيادات في التحذير منها، إلا أنها كشفت عن تطوير الجنود في الخنادق لـ \"قيود على العنف\" ومبدأ \"عش ودع الآخرين يعيشون\"، مما أظهر العبء النفسي الهائل لحرب الخنادق والانفصال بين الجنود والقيادات العليا.", 21),
            ("الهجوم الألماني الأول بالغاز السام (معركة إيبر الثانية)", "22 أبريل 1915 م", "8 جمادى الآخرة 1333 هـ", "مدينة إيبر (Ypres)، بلجيكا",
             "في محاولة لكسر جمود حرب الخنادق، استخدم الجيش الألماني الغاز السام ضد خطوط الحلفاء.",
             "أطلق هذا الهجوم شرارة سباق التسلح الكيميائي المحموم بين الدول المتحاربة، مما أضاف أسلحة محملة بالغازات إلى ساحات المعارك، وفرض على الجيوش تطوير وسائل وقاية كأقنعة الغاز.", 22),
            ("إقرار الولايات المتحدة لقانون \"الخدمة الانتقائية\" (التجنيد الإلزامي)", "18 مايو 1917 م", "26 رجب 1335 هـ (تقريباً)", "الولايات المتحدة الأمريكية",
             "لعدم كفاية الجيش النظامي الصغير (127 ألف مقاتل) والحرس الوطني، ولإعداد قوات ضخمة للقتال في أوروبا، أقرت الحكومة الأمريكية نظام التجنيد الإلزامي عبر قرعة \"اليانصيب\"، ليتم تسجيل ملايين الشبان وتحويلهم في معسكرات تدريب ضخمة إلى جيش مقاتل.",
             "مكّن هذا التشريع الولايات المتحدة من حشد جيش ضخم تجاوز أربعة ملايين رجل (خَدَم أكثر من مليونين منهم في فرنسا). وقد شكّل هذا الضخ الهائل للقوات الطازجة العامل الذي رجح كفة الحلفاء وأجهض الآمال الألمانية، خاصة خلال الهجمات الحاسمة في خريف 1918.", 23),
            ("مجاعة \"شتاء اللفت\"", "شتاء 1916 - 1917 م (تحديداً أوائل 1917)", "ربيع الأول - ربيع الآخر 1335 هـ", "ألمانيا (الجبهة الداخلية)",
             "بسبب الحصار البحري البريطاني الخانق وفشل محصول البطاطا، عانى السكان المدنيون في ألمانيا من نقص حاد في الغذاء. اضطرت العائلات للاعتماد بشكل شبه كلي على \"اللفت\" (الذي كان يُستخدم سابقاً كعلف للحيوانات) كبديل غذائي، مما أدى إلى انتشار سوء التغذية.",
             "أدى هذا النقص الحاد في الحصص الغذائية إلى تدهور خطير في الروح المعنوية الألمانية على الجبهة الداخلية، وزيادة الإضرابات العمالية، وشكل ضغطاً هائلاً على الحكومة الألمانية لاتخاذ قرارات يائسة مثل استئناف \"حرب الغواصات المفتوحة\" لكسر الحصار.", 24),
            ("التحاق النساء رسمياً بالقوات المسلحة", "مارس 1917 م وما بعده", "جمادى الأولى 1335 هـ", "بريطانيا والولايات المتحدة الأمريكية",
             "مع تزايد الخسائر البشرية واستنزاف الرجال في الخنادق، بدأت النساء بالالتحاق رسمياً في الجيش البريطاني ضمن \"قوات الاحتياط النسائية\"، وكذلك التحقن في البحرية الأمريكية كعضوات في الحرس الوطني لتولي مهام الدعم الإداري واللوجستي.",
             "مثّل هذا التطور تغييراً جذرياً في تركيبة الجيوش التي كانت تقتصر على الذكور. أثبتت هذه الخطوة الأهمية القصوى لمساهمة المرأة في المجهود الحربي، وهو ما مهّد الطريق لاحقاً لتغيرات اجتماعية كبرى، أبرزها حصول النساء على حق التصويت في عدة دول بعد الحرب.", 25),
            ("إدخال سلاح \"قاذف اللهب\" إلى ساحات المعارك", "عام 1915 م", "1333 هـ", "ساحات القتال القريب على الجبهة الغربية",
             "أدخل الجيش الألماني قاذفات اللهب المحمولة كأداة قتالية جديدة. كان السلاح يتطلب فريقاً من جنديين لتشغيله، واستُخدم لتمهيد الطريق أمام وحدات المشاة الهجومية عن طريق إطلاق النيران داخل خنادق العدو ومخابئه من مسافات قريبة.",
             "أضاف هذا السلاح بُعداً نفسياً مرعباً لحرب الخنادق وبث الذعر المباشر في صفوف المدافعين. ورغم محدودية مداه التكتيكي، إلا أنه ساهم في تطوير أساليب \"قوات الصدمة\" لاقتحام التحصينات، وسرعان ما تبنت الجيوش الأخرى أسلحة مشابهة.", 26),
            ("تفشي جائحة \"الأنفلونزا الإسبانية\"", "ربيع عام 1918 م", "رجب - شعبان 1336 هـ", "الجبهات العسكرية والمدن على نطاق عالمي",
             "انتشرت سلالة قاتلة من الأنفلونزا كالنار في الهشيم بين الجيوش المتحاربة والمدنيين. سهّلت الخنادق المكتظة، وضعف المناعة بسبب سوء التغذية، وحركة القوات الكثيفة عبر المحيطات، انتقال الفيروس بسرعة غير مسبوقة.",
             "تسببت الجائحة في إضعاف القدرة القتالية للجيوش بشكل حاد واستنزفت الموارد الطبية المنهكة أصلاً. لقد حصدت الجائحة أرواح ملايين البشر (متجاوزةً أعداد من سقطوا في جبهات القتال)، مما سرّع من إنهاك الدول المشاركة وانهيار قدرتها على الاستمرار في الحرب.", 27),
        };

        int count = 0;
        foreach (var e in events)
        {
            var check = await Query("SELECT \"Id\" FROM \"HistoricalEvents\" WHERE \"UserId\"=@uid AND \"OrderIndex\"=@oi AND \"Category\"='الحرب العالمية الأولى' LIMIT 1",
                [P("@uid", Uid), P("@oi", e.Order)], ct);
            if (check.Count > 0) continue;

            await Exec(@"INSERT INTO ""HistoricalEvents"" (""Id"",""UserId"",""Title"",""GregorianDate"",""HijriDate"",""Location"",""Description"",""StrategicSignificance"",""OrderIndex"",""Category"")
                VALUES(@id,@uid,@ti,@gd,@hd,@lo,@de,@ss,@oi,@ca)",
                [P("@id",Guid.NewGuid().ToString()),P("@uid",Uid),P("@ti",e.Title),
                 P("@gd",e.GDate),P("@hd",e.HDate),P("@lo",e.Location),
                 P("@de",e.Desc),P("@ss",e.Sig),P("@oi",e.Order),
                 P("@ca","الحرب العالمية الأولى")], ct);
            count++;
        }
        return Ok(new { message = $"تم إدخال {count} أحداث جديدة", count });
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories(CancellationToken ct)
    {
        return Ok(await Query("SELECT DISTINCT \"Category\" FROM \"HistoricalEvents\" WHERE \"UserId\"=@uid AND \"Category\"!='' ORDER BY \"Category\"",
            [P("@uid", Uid)], ct));
    }

    // ─── DATE CONVERSION ─────────────────────────────────────────────────
    [HttpGet("convert-date")]
    public IActionResult ConvertDate([FromQuery] string? hijriYear, [FromQuery] string? hijriMonth, [FromQuery] string? hijriDay,
        [FromQuery] string? gregorianDate)
    {
        // Hijri → Gregorian
        if (int.TryParse(hijriYear, out var hy) && int.TryParse(hijriMonth, out var hm) && int.TryParse(hijriDay, out var hd))
        {
            var greg = Helpers.DateConverter.HijriToGregorian(hy, hm, hd);
            if (greg == null) return BadRequest(new { error = "تاريخ هجري غير صحيح" });
            return Ok(new {
                hijriText = Helpers.DateConverter.FormatHijri(hy, hm, hd),
                gregorianText = Helpers.DateConverter.FormatGregorian(greg.Value),
                gregorianDate = greg.Value.ToString("yyyy-MM-dd"),
            });
        }
        // Gregorian → Hijri
        if (DateTime.TryParse(gregorianDate, out var gd))
        {
            var (y, m, d) = Helpers.DateConverter.GregorianToHijri(gd);
            return Ok(new {
                hijriText = Helpers.DateConverter.FormatHijri(y, m, d),
                gregorianText = Helpers.DateConverter.FormatGregorian(gd),
                hijriYear = y, hijriMonth = m, hijriDay = d,
            });
        }
        return BadRequest(new { error = "أدخل hijriYear+hijriMonth+hijriDay أو gregorianDate" });
    }

    // ─── EXCEL TEMPLATE DOWNLOAD ────────────────────────────────────────
    [HttpGet("template")]
    public IActionResult DownloadTemplate()
    {
        OfficeOpenXml.ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        using var pkg = new OfficeOpenXml.ExcelPackage();
        var ws = pkg.Workbook.Worksheets.Add("أحداث تاريخية");
        ws.View.RightToLeft = true;

        // Headers (row 1): 8 main + 3 hijri helper columns
        var headers = new[] { "العنوان *", "التاريخ الميلادي", "التاريخ الهجري", "المكان", "الوصف", "الأهمية الاستراتيجية", "الفئة", "الترتيب",
            "السنة الهجرية (تحويل تلقائي)", "الشهر الهجري", "اليوم الهجري" };
        for (int i = 0; i < headers.Length; i++)
        {
            ws.Cells[1, i + 1].Value = headers[i];
            ws.Cells[1, i + 1].Style.Font.Bold = true;
            ws.Cells[1, i + 1].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            var isHelper = i >= 8;
            ws.Cells[1, i + 1].Style.Fill.BackgroundColor.SetColor(isHelper
                ? System.Drawing.Color.FromArgb(61, 140, 90) : System.Drawing.Color.FromArgb(44, 44, 84));
            ws.Cells[1, i + 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
        }

        // Instructions row (row 2)
        ws.Cells[2, 1].Value = "⬇ أدخل بياناتك من الصف 3";
        ws.Cells[2, 1].Style.Font.Color.SetColor(System.Drawing.Color.Red);
        ws.Cells[2, 1].Style.Font.Bold = true;
        ws.Cells[2, 2].Value = "نص حر: 28 يونيو 1914 م";
        ws.Cells[2, 3].Value = "نص حر: 4 شعبان 1332 هـ";
        ws.Cells[2, 9].Value = "اختياري: أدخل السنة الهجرية هنا";
        ws.Cells[2, 10].Value = "1-12";
        ws.Cells[2, 11].Value = "1-30";
        for (int c = 1; c <= 11; c++) ws.Cells[2, c].Style.Font.Color.SetColor(System.Drawing.Color.Gray);

        // Example rows (3-4)
        ws.Cells[3, 1].Value = "فتح مكة"; ws.Cells[3, 2].Value = "11 يناير 630 م"; ws.Cells[3, 3].Value = "20 رمضان 8 هـ";
        ws.Cells[3, 4].Value = "مكة المكرمة"; ws.Cells[3, 5].Value = "دخل النبي ﷺ مكة فاتحاً بعشرة آلاف مقاتل";
        ws.Cells[3, 6].Value = "نقطة تحول في تاريخ الإسلام"; ws.Cells[3, 7].Value = "فتوحات"; ws.Cells[3, 8].Value = 1;
        ws.Cells[3, 9].Value = 8; ws.Cells[3, 10].Value = 9; ws.Cells[3, 11].Value = 20;

        ws.Cells[4, 1].Value = "اغتيال ولي عهد النمسا"; ws.Cells[4, 2].Value = "28 يونيو 1914 م"; ws.Cells[4, 3].Value = "4 شعبان 1332 هـ";
        ws.Cells[4, 4].Value = "سراييفو"; ws.Cells[4, 5].Value = "شرارة الحرب العالمية الأولى";
        ws.Cells[4, 6].Value = "بداية تغيير خريطة العالم"; ws.Cells[4, 7].Value = "الحرب العالمية الأولى"; ws.Cells[4, 8].Value = 2;
        ws.Cells[4, 9].Value = 1332; ws.Cells[4, 10].Value = 8; ws.Cells[4, 11].Value = 4;

        // Style example rows lighter
        for (int row = 2; row <= 3; row++)
            for (int col = 1; col <= 8; col++)
            {
                ws.Cells[row, col].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                ws.Cells[row, col].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(255, 253, 235));
                ws.Cells[row, col].Style.Font.Color.SetColor(System.Drawing.Color.Gray);
            }

        // Auto-fit columns
        ws.Cells[ws.Dimension.Address].AutoFitColumns(12, 50);

        var bytes = pkg.GetAsByteArray();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "نموذج-أحداث-تاريخية.xlsx");
    }

    // ─── BULK EXCEL UPLOAD ──────────────────────────────────────────────
    [HttpPost("upload")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadExcel(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = "لا يوجد ملف" });
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "يجب أن يكون الملف Excel (.xlsx)" });

        OfficeOpenXml.ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        stream.Position = 0;

        using var pkg = new OfficeOpenXml.ExcelPackage(stream);
        var ws = pkg.Workbook.Worksheets.FirstOrDefault();
        if (ws == null) return BadRequest(new { error = "الملف فارغ" });

        var errors = new List<string>();
        int saved = 0;
        // Start from row 3 (row 1 = headers, row 2 = instructions)
        for (int row = 3; row <= ws.Dimension.End.Row; row++)
        {
            var title = ws.Cells[row, 1].Text?.Trim();
            if (string.IsNullOrEmpty(title)) continue;

            var gregorianDate = ws.Cells[row, 2].Text?.Trim();
            var hijriDate = ws.Cells[row, 3].Text?.Trim();
            var location = ws.Cells[row, 4].Text?.Trim();
            var description = ws.Cells[row, 5].Text?.Trim();
            var strategicSig = ws.Cells[row, 6].Text?.Trim();
            var category = ws.Cells[row, 7].Text?.Trim();
            int.TryParse(ws.Cells[row, 8].Text?.Trim(), out var orderIdx);

            // Auto-convert from Hijri columns (I, J, K) if hijriDate text is empty
            if (string.IsNullOrEmpty(hijriDate))
            {
                int.TryParse(ws.Cells[row, 9].Text?.Trim(), out var hy);
                int.TryParse(ws.Cells[row, 10].Text?.Trim(), out var hm);
                int.TryParse(ws.Cells[row, 11].Text?.Trim(), out var hday);
                if (hy > 0 && hm > 0 && hday > 0)
                {
                    hijriDate = Helpers.DateConverter.FormatHijri(hy, hm, hday);
                    if (string.IsNullOrEmpty(gregorianDate))
                    {
                        var greg = Helpers.DateConverter.HijriToGregorian(hy, hm, hday);
                        if (greg != null) gregorianDate = Helpers.DateConverter.FormatGregorian(greg.Value);
                    }
                }
            }

            try
            {
                await Exec(@"INSERT INTO ""HistoricalEvents"" (""Id"",""UserId"",""Title"",""GregorianDate"",""HijriDate"",""Location"",""Description"",""StrategicSignificance"",""OrderIndex"",""Category"")
                    VALUES(@id,@uid,@ti,@gd,@hd,@lo,@de,@ss,@oi,@ca)",
                    [P("@id",Guid.NewGuid().ToString()),P("@uid",Uid),P("@ti",title),
                     P("@gd",string.IsNullOrEmpty(gregorianDate)?DBNull.Value:gregorianDate),
                     P("@hd",string.IsNullOrEmpty(hijriDate)?DBNull.Value:hijriDate),
                     P("@lo",string.IsNullOrEmpty(location)?DBNull.Value:location),
                     P("@de",string.IsNullOrEmpty(description)?DBNull.Value:description),
                     P("@ss",string.IsNullOrEmpty(strategicSig)?DBNull.Value:strategicSig),
                     P("@oi",orderIdx),P("@ca",category??"")], ct);
                saved++;
            }
            catch (Exception ex) { errors.Add($"صف {row}: {ex.Message}"); }
        }

        return Ok(new { message = $"تم حفظ {saved} حدث", count = saved, errors = errors.Count > 0 ? errors : null });
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    static NpgsqlParameter P(string n, object? v) =>
        v is string s && Guid.TryParse(s, out var g)
            ? new NpgsqlParameter(n, NpgsqlTypes.NpgsqlDbType.Uuid) { Value = g }
            : new(n, v ?? DBNull.Value);

    private async Task<List<Dictionary<string, object?>>> Query(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
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

    private async Task<int> Exec(string sql, List<NpgsqlParameter> ps, CancellationToken ct)
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
