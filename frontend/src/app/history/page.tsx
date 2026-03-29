"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface HistoryRecord {
  id: string; year: number; month?: number; day?: number;
  hijriYear: number; hijriMonth?: number; hijriDay?: number;
  inputType: string;
  title: string; description?: string; figure?: string; location?: string;
  country?: string; category: string; strategicImportance?: string;
  importance: string; source?: string; tags?: string;
}

interface HistoryFigure {
  id: string; name: string; birthYear?: number; deathYear?: number;
  role?: string; nationality?: string; category?: string; bio?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

// ألوان عشوائية مستقرة للفئات
const CAT_COLORS = ["#DC2626","#7C3AED","#92400E","#059669","#2563EB","#D97706","#6B7280","#0891B2","#BE185D","#4F46E5"];
function catColor(cat: string): string {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = ((h << 5) - h + cat.charCodeAt(i)) | 0;
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

const IMP_COLORS: Record<string, string> = {};
function impColor(imp: string): string {
  if (IMP_COLORS[imp]) return IMP_COLORS[imp];
  const colors = ["#6B7280","#D97706","#DC2626","#059669","#2563EB","#7C3AED"];
  let h = 0;
  for (let i = 0; i < imp.length; i++) h = ((h << 5) - h + imp.charCodeAt(i)) | 0;
  IMP_COLORS[imp] = colors[Math.abs(h) % colors.length];
  return IMP_COLORS[imp];
}

/* ─── Hijri conversion (client-side for instant preview) ─────────────── */
function hijriToGreg(h: number): number { return Math.round(h * 0.970229 + 621.5709); }
function gregToHijri(g: number): number { return Math.round((g - 621.5709) / 0.970229); }

/* ─── Era helpers ────────────────────────────────────────────────────── */

interface Era { label: string; from: number; to: number; }

function buildEras(): Era[] {
  const eras: Era[] = [];
  // قبل الميلاد
  for (let s = -4000; s < 0; s += 1000)
    eras.push({ label: `${Math.abs(s)} ق.م — ${Math.abs(s + 1000)} ق.م`, from: s, to: s + 999 });
  // بعد الميلاد — قرون
  for (let c = 0; c < 21; c++) {
    const from = c * 100 + 1;
    const to = (c + 1) * 100;
    const names = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر",
      "الحادي عشر","الثاني عشر","الثالث عشر","الرابع عشر","الخامس عشر","السادس عشر","السابع عشر","الثامن عشر","التاسع عشر","العشرون","الحادي والعشرون"];
    eras.push({ label: `القرن ${names[c]} (${from}-${to}م)`, from, to });
  }
  return eras;
}

const ALL_ERAS = buildEras();
const CURRENT_CENTURY_IDX = ALL_ERAS.findIndex(e => e.from <= new Date().getFullYear() && e.to >= new Date().getFullYear());

/* ─── Page ───────────────────────────────────────────────────────────── */

interface HistoricalEvent {
  id: string; title: string; gregorianDate?: string; hijriDate?: string;
  location?: string; description?: string; strategicSignificance?: string;
  orderIndex: number; category: string;
}

type PageTab = "timeline" | "events";

const WW1_EVENTS: HistoricalEvent[] = [
  {id:"e1",orderIndex:1,category:"الحرب العالمية الأولى",title:"اغتيال ولي عهد النمسا والمجر (فرانز فرديناند)",gregorianDate:"28 يونيو 1914 م",hijriDate:"4 شعبان 1332 هـ",location:"سراييفو (البوسنة)",description:"قام طالب صربي قومي يُدعى \"غافريلو برينسيب\" باغتيال ولي عهد الإمبراطورية النمساوية المجرية وزوجته. كان هذا الحدث بمثابة الشرارة المباشرة التي أشعلت فتيل التوترات المتراكمة في أوروبا.",strategicSignificance:"أدى هذا الاغتيال إلى توجيه النمسا والمجر إنذاراً شديد اللهجة لصربيا، مما دفع التحالفات الأوروبية للتدخل وتصعيد الأزمة."},
  {id:"e2",orderIndex:2,category:"الحرب العالمية الأولى",title:"إعلان النمسا والمجر الحرب على صربيا",gregorianDate:"28 يوليو 1914 م",hijriDate:"5 رمضان 1332 هـ",location:"أوروبا الوسطى والبلقان",description:"بعد رفض صربيا لبعض شروط الإنذار النمساوي، أعلنت الإمبراطورية النمساوية المجرية الحرب عليها. وبدأت روسيا (حليفة صربيا) بالتعبئة العامة لجيوشها.",strategicSignificance:"تفعيل نظام \"التحالفات المتشابكة\" في أوروبا، مما جرّ دولاً أخرى إلى ساحة المعركة تباعاً."},
  {id:"e3",orderIndex:3,category:"الحرب العالمية الأولى",title:"تفعيل \"خطة شليفن\" وغزو بلجيكا",gregorianDate:"4 أغسطس 1914 م",hijriDate:"12 رمضان 1332 هـ",location:"بلجيكا وفرنسا",description:"أعلنت ألمانيا الحرب على روسيا وفرنسا. ولتجنب القتال على جبهتين، نفذت ألمانيا خطة لتوجيه ضربة سريعة لفرنسا عبر غزو بلجيكا (المحايدة) للوصول إلى باريس.",strategicSignificance:"أدى غزو بلجيكا إلى دفع بريطانيا لإعلان الحرب على ألمانيا فوراً، لتكتمل بذلك أطراف النزاع الرئيسية."},
  {id:"e4",orderIndex:4,category:"الحرب العالمية الأولى",title:"معركة المارن الأولى (وقف التقدم الألماني)",gregorianDate:"6 - 12 سبتمبر 1914 م",hijriDate:"16 - 22 شوال 1332 هـ",location:"حوض نهر المارن، فرنسا",description:"شنت القوات الفرنسية والبريطانية هجوماً مضاداً حاسماً ضد الجيش الألماني الذي كان يزحف بسرعة نحو العاصمة باريس، ونجحت في إيقاف تقدمه وإجباره على التراجع.",strategicSignificance:"فشل خطة \"شليفن\" الألمانية في تحقيق نصر سريع، وبداية تأسيس نظام \"حرب الخنادق\" الذي جمّد الجبهة الغربية لسنوات."},
  {id:"e5",orderIndex:5,category:"الحرب العالمية الأولى",title:"دخول الدولة العثمانية الحرب العالمية الأولى",gregorianDate:"29 أكتوبر 1914 م",hijriDate:"9 ذو الحجة 1332 هـ",location:"البحر الأسود والجبهات الشرقية",description:"قامت سفن حربية عثمانية (تحت قيادة ألمانية) بقصف موانئ روسية على سواحل البحر الأسود، مما أدخل الدولة العثمانية الحرب رسمياً إلى جانب ألمانيا والنمسا (دول المركز).",strategicSignificance:"إعلان روسيا وبريطانيا وفرنسا الحرب على الدولة العثمانية، مما وسّع نطاق الحرب لتشمل الشرق الأوسط وشمال أفريقيا، وفتح جبهات قتال جديدة."},
  {id:"e6",orderIndex:6,category:"الحرب العالمية الأولى",title:"حملة جاليبولي (معارك مضيق الدردنيل)",gregorianDate:"19 فبراير 1915 م (بداية الحملة)",hijriDate:"5 ربيع الآخر 1333 هـ",location:"شبه جزيرة جاليبولي (الدولة العثمانية)",description:"شنت بريطانيا وفرنسا هجوماً بحرياً وبرياً ضخماً للسيطرة على مضيق الدردنيل بهدف احتلال العاصمة العثمانية (إسطنبول) وفتح طريق إمداد بحري آمن إلى روسيا.",strategicSignificance:"صمود عثماني قوي وانتصار دفاعي كبير، أدى في النهاية إلى انسحاب قوات الحلفاء بعد أشهر من القتال الدامي وتكبدهم خسائر فادحة."},
  {id:"e7",orderIndex:7,category:"الحرب العالمية الأولى",title:"معركة فردان (أطول معارك الحرب)",gregorianDate:"21 فبراير - 18 ديسمبر 1916 م",hijriDate:"17 ربيع الآخر - 23 صفر 1335 هـ",location:"مدينة فردان، الجبهة الغربية (شمال شرق فرنسا)",description:"شنت القيادة الألمانية هجوماً مدفعياً وبرياً مكثفاً ومستمراً على سلسلة الحصون الفرنسية المحيطة بمدينة فردان، بهدف دفع الجيش الفرنسي إلى نقطة الانهيار عبر \"استنزاف دمائه\". اتسمت المعركة بوحشية غير مسبوقة وتحولت إلى حرب خنادق واستنزاف طاحنة استمرت لما يقارب العشرة أشهر.",strategicSignificance:"رغم الخسائر البشرية المرعبة للطرفين، فشلت ألمانيا في تحقيق هدفها باختراق الجبهة أو إسقاط فرنسا. أصبحت فردان رمزاً للصلابة الدفاعية، ولكنها استنزفت الموارد العسكرية الألمانية بشكل خطير، وأضعفت قدرتها المستقبلية على المبادرة بالهجوم."},
  {id:"e8",orderIndex:8,category:"الحرب العالمية الأولى",title:"معركة السوم (ظهور الدبابات الأول)",gregorianDate:"1 يوليو - 18 نوفمبر 1916 م",hijriDate:"1 شعبان - 22 محرم 1335 هـ",location:"حوض نهر السوم، شمال فرنسا",description:"نفذت القوات البريطانية والفرنسية هجوماً واسع النطاق ضد الخطوط الألمانية لتخفيف الضغط الخانق عن جبهة فردان. شهد اليوم الأول من المعركة أكبر خسارة في تاريخ الجيش البريطاني، وفي هذه المعركة تم إدخال سلاح \"الدبابة\" لأول مرة في التاريخ العسكري لكسر جمود الخنادق.",strategicSignificance:"أثبتت المعركة أن قوات الحلفاء قادرة على تحمل حرب استنزاف طويلة الأمد. ورغم التقدم الجغرافي المحدود، أجبرت هذه المعركة الجيش الألماني لاحقاً على التراجع التكتيكي وإعادة التموضع، وبدأت موازين القوى تميل تدريجياً لصالح الحلفاء بفضل التفوق العددي والصناعي."},
  {id:"e9",orderIndex:9,category:"الحرب العالمية الأولى",title:"انطلاق الثورة العربية الكبرى",gregorianDate:"10 يونيو 1916 م",hijriDate:"9 شعبان 1334 هـ",location:"الحجاز وامتدت إلى بلاد الشام",description:"أعلن الشريف حسين بن علي الثورة المسلحة ضد الدولة العثمانية بدعم وتنسيق عسكري ولوجستي من بريطانيا. شملت العمليات العسكرية السيطرة على مكة، وتنفيذ حرب عصابات لتعطيل خط سكة حديد الحجاز، ومهاجمة الحاميات العسكرية العثمانية.",strategicSignificance:"نجحت في تشتيت جزء كبير من القوات العثمانية وإلزامها بالبقاء في الحجاز والشام لحماية خطوط الإمداد، مما خفف الضغط عن القوات البريطانية وسهّل تقدمها لاحقاً في فلسطين وسوريا، وشكلت بداية لتغيير الخارطة السياسية للشرق الأوسط."},
  {id:"e10",orderIndex:10,category:"الحرب العالمية الأولى",title:"دخول الولايات المتحدة الأمريكية الحرب",gregorianDate:"6 أبريل 1917 م",hijriDate:"14 جمادى الآخرة 1335 هـ",location:"واشنطن (صنع القرار) والتأثير على الجبهة الغربية والبحرية",description:"بعد سلسلة من التوترات، أبرزها استئناف ألمانيا لحرب الغواصات المفتوحة (التي استهدفت السفن التجارية الأمريكية) واعتراض المخابرات البريطانية لـ\"برقية زيمرمان\" (التي حاولت فيها ألمانيا تحريض المكسيك لشن حرب ضد أمريكا)، أعلن الرئيس الأمريكي وودرو ويلسون دخول بلاده الحرب ضد الإمبراطورية الألمانية.",strategicSignificance:"يُعد هذا الحدث نقطة التحول الأهم في الحرب؛ إذ وفر التدخل الأمريكي ضخاً هائلاً للقوات البشرية الطازجة، والإمدادات الصناعية، والقدرات المالية للحلفاء في وقت كانوا يعانون فيه من إنهاك شديد، مما رجّح كفة النصر نهائياً وأنهى الآمال الألمانية."},
  {id:"e11",orderIndex:11,category:"الحرب العالمية الأولى",title:"الثورة البلشفية وخروج روسيا من الحرب (معاهدة بريست ليتوفسك)",gregorianDate:"7 نوفمبر 1917 م (الثورة) - 3 مارس 1918 م (توقيع المعاهدة)",hijriDate:"21 محرم 1336 هـ - 19 جمادى الأولى 1336 هـ",location:"روسيا والجبهة الشرقية",description:"قاد فلاديمير لينين والبلاشفة ثورة أطاحت بالحكومة الروسية. وبسبب الانهيار الداخلي والرفض الشعبي الواسع للحرب، سارعت الحكومة السوفيتية الجديدة لتوقيع معاهدة سلام منفصلة مع ألمانيا (بريست ليتوفسك)، متنازلة بموجبها عن مساحات شاسعة من الأراضي والموارد.",strategicSignificance:"أدى خروج روسيا إلى إغلاق الجبهة الشرقية بالكامل، مما منح ألمانيا فرصة ذهبية لنقل عشرات الفرق العسكرية إلى الجبهة الغربية لشن هجوم حاسم ومحاولة كسب الحرب قبل وصول القوات الأمريكية بأعداد كبيرة."},
  {id:"e12",orderIndex:12,category:"الحرب العالمية الأولى",title:"هجوم الربيع الألماني (هجوم لودندورف)",gregorianDate:"21 مارس - 18 يوليو 1918 م",hijriDate:"8 جمادى الآخرة - 9 شوال 1336 هـ",location:"الجبهة الغربية (فرنسا وبلجيكا)",description:"شنت القوات الألمانية سلسلة من الهجمات المكثفة والمباغتة مستخدمة تكتيكات \"قوات الصدمة\" لكسر خطوط الحلفاء وإنهاء الحرب. حقق الهجوم في أسابيعه الأولى تقدماً عميقاً وغير مسبوق منذ عام 1914، وكاد أن يفصل بين القوات البريطانية والفرنسية.",strategicSignificance:"رغم النجاح التكتيكي والتقدم الجغرافي، استُنزفت قوات النخبة الألمانية، وتمددت خطوط إمدادها بشكل مفرط أدى لضعفها. شكّل فشل هذا الهجوم في تحقيق نصر استراتيجي قاضٍ نقطة اللاعودة، وبداية النهاية للقدرة الهجومية للإمبراطورية الألمانية."},
  {id:"e13",orderIndex:13,category:"الحرب العالمية الأولى",title:"هجوم المائة يوم (الهجوم المضاد الشامل للحلفاء)",gregorianDate:"8 أغسطس - 11 نوفمبر 1918 م",hijriDate:"30 شوال - 6 صفر 1337 هـ",location:"الجبهة الغربية (بدءاً من معركة أميان)",description:"شن الحلفاء (بقيادة بريطانية وفرنسية وبدعم أمريكي كثيف) سلسلة من الهجمات المنسقة. استخدم الحلفاء تكتيكات الأسلحة المشتركة (تنسيق المشاة، الدبابات، الطيران، والمدفعية) لخرق الدفاعات الألمانية الحصينة (مثل خط هيندنبيرغ) وإجبار الجيش الألماني على تراجع مستمر لا توقف فيه.",strategicSignificance:"أدى هذا الهجوم الماحق إلى انهيار الروح المعنوية والقدرة العسكرية للجيش الألماني. أدركت القيادة العليا الألمانية حتمية الهزيمة، وتزامن ذلك مع الانهيار الداخلي واستسلام حلفاء ألمانيا (بلغاريا، الدولة العثمانية، ثم النمسا والمجر) واحداً تلو الآخر."},
  {id:"e14",orderIndex:14,category:"الحرب العالمية الأولى",title:"توقيع هدنة كومبيان وانتهاء العمليات العسكرية",gregorianDate:"11 نوفمبر 1918 م (دخلت حيز التنفيذ الساعة 11 صباحاً)",hijriDate:"6 صفر 1337 هـ",location:"غابة كومبيان، فرنسا (داخل عربة قطار)",description:"في أعقاب تمرد عسكري داخلي أدى إلى تنازل القيصر الألماني \"فيلهلم الثاني\" عن العرش وإعلان الجمهورية، وقّع الوفد الألماني على اتفاقية هدنة قاسية مع الحلفاء تنص على الوقف الفوري لإطلاق النار، والانسحاب من الأراضي المحتلة، وتسليم العتاد العسكري الثقيل.",strategicSignificance:"أنهت هذه الهدنة أربع سنوات من النزاع الدموي المدمّر، ومثّلت السقوط الفعلي للإمبراطوريات العظمى (الألمانية، الروسية، العثمانية، النمساوية المجرية). كما مهدت الطريق لمؤتمر باريس ومعاهدة فرساي (1919) التي أعادت رسم خريطة العالم وأسست لواقع جيوسياسي جديد."},
  {id:"e15",orderIndex:15,category:"الحرب العالمية الأولى",title:"مؤتمر باريس للسلام",gregorianDate:"18 يناير 1919 م",hijriDate:"16 ربيع الآخر 1337 هـ",location:"باريس، فرنسا",description:"اجتمع قادة الدول المنتصرة (الحلفاء) لصياغة شروط السلام وفرضها على الدول المنهزمة (دول المركز). غابت عن المؤتمر الدول المهزومة وروسيا السوفيتية، وسيطر على القرارات ما عُرف بـ \"الأربعة الكبار\" (قادة بريطانيا، فرنسا، الولايات المتحدة، وإيطاليا).",strategicSignificance:"أسس هذا المؤتمر لنظام دولي جديد، وتمت فيه هندسة خريطة سياسية جديدة للعالم شملت تقسيم إمبراطوريات الوسط المنهزمة، وتوزيع مناطق النفوذ والانتداب (خاصة في الشرق الأوسط)، مما شكل جذوراً للعديد من الصراعات الجيوسياسية المعاصرة."},
  {id:"e16",orderIndex:16,category:"الحرب العالمية الأولى",title:"توقيع معاهدة فرساي",gregorianDate:"28 يونيو 1919 م",hijriDate:"29 رمضان 1337 هـ",location:"قصر فرساي، باريس",description:"المعاهدة الرئيسية التي أنهت حالة الحرب رسمياً بين ألمانيا والحلفاء. تضمنت شروطاً قاسية جداً ومذلة على ألمانيا، شملت التجريد العسكري الواسع، ودفع تعويضات مالية ضخمة جداً، واقتطاع أجزاء من أراضيها لصالح دول مجاورة، وتحميلها قانونياً المسؤولية الكاملة عن اندلاع الحرب.",strategicSignificance:"أدت هذه الشروط القاسية إلى انهيار الاقتصاد الألماني لاحقاً وتوليد شعور عميق بالإذلال القومي، مما خلق بيئة سياسية واجتماعية خصبة لظهور الحركات المتطرفة (مثل الحزب النازي) ومهد الطريق فعلياً لاندلاع الحرب العالمية الثانية."},
  {id:"e17",orderIndex:17,category:"الحرب العالمية الأولى",title:"تأسيس عصبة الأمم",gregorianDate:"10 يناير 1920 م",hijriDate:"18 ربيع الآخر 1338 هـ",location:"جنيف، سويسرا (المقر الرئيسي)",description:"منظمة دولية تأسست بناءً على المبادئ التي طرحها الرئيس الأمريكي \"وودرو ويلسون\"، بهدف الحفاظ على السلام العالمي، ومنع نشوب حروب مستقبلية عبر تفعيل الدبلوماسية، ونزع السلاح، وتطبيق مبدأ الأمن الجماعي لحل النزاعات بين الدول.",strategicSignificance:"كانت أول محاولة جادة ومؤسسية لتأسيس نظام أمن دولي يجمع دول العالم. ورغم فشلها لاحقاً في منع اندلاع الحرب العالمية الثانية (بسبب افتقارها لقوة عسكرية رادعة وانسحاب قوى كبرى منها)، إلا أنها وضعت الأساس القانوني والتنظيمي الذي بُنيت عليه منظمة \"الأمم المتحدة\" الحالية."},
  {id:"e18",orderIndex:18,category:"الحرب العالمية الأولى",title:"معاهدة سيفر وتقسيم الدولة العثمانية",gregorianDate:"10 أغسطس 1920 م",hijriDate:"25 ذو القعدة 1338 هـ",location:"سيفر، فرنسا",description:"معاهدة سلام فرضها الحلفاء على الدولة العثمانية، نصت على تخلي العثمانيين عن جميع أراضيهم غير الناطقة بالتركية (في بلاد الشام، العراق، وشبه الجزيرة العربية)، وتقسيم أجزاء واسعة من الأناضول بين الحلفاء، مع فرض نظام الانتداب (البريطاني والفرنسي) على الأراضي العربية.",strategicSignificance:"مثّلت النهاية الرسمية والتمزيق الفعلي للإمبراطورية العثمانية، وكرّست واقع اتفاقية (سايكس بيكو)، مما أسس للحدود السياسية الحديثة في الشرق الأوسط. كما أدت قسوة المعاهدة إلى اندلاع حرب الاستقلال التركية التي نجحت في إلغاء المعاهدة واستبدالها بمعاهدة لوزان (1923)."},
  {id:"e19",orderIndex:19,category:"الحرب العالمية الأولى",title:"تشريع نظام التجنيد الإجباري في بريطانيا",gregorianDate:"17 مايو 1916 م",hijriDate:"14 رجب 1334 هـ (تقريباً)",location:"بريطانيا العظمى",description:"بعد أن كان الجيش البريطاني يعتمد كلياً على المتطوعين، وأمام تدفق المجندين غير الكافي لسد النقص الحاد، أقرت الحكومة البريطانية نظام التجنيد الإجباري لضمان توفير الجنود للقوات المسلحة.",strategicSignificance:"مثّل هذا تحولاً جذرياً سمح لبريطانيا بتكوين جيش موسع قادر على خوض حرب استنزاف طويلة الأمد ضد ألمانيا على الجبهة الغربية، وتعويض الخسائر الفادحة في المعارك الكبرى مثل معركة \"السوم\"."},
  {id:"e20",orderIndex:20,category:"الحرب العالمية الأولى",title:"بدء \"حرب الخنادق\" وإنشاء الأنظمة الدفاعية المعقدة",gregorianDate:"خريف 1914 م",hijriDate:"أواخر 1332 هـ",location:"الجبهة الغربية (من ساحل القنال الإنجليزي حتى سويسرا)",description:"بعد فشل \"الحرب المتنقلة\" السريعة لكلا الطرفين، حفرت الجيوش الخنادق للاحتماء، فتحولت الأرض إلى شبكات معقدة من الخنادق المتوازية والمتقاطعة المدعمة بالأسلاك الشائكة والمخابئ العميقة المقاومة للمدفعية، تفصل بينها منطقة عازلة مميتة تُعرف بـ \"الأرض المحايدة\".",strategicSignificance:"أدى هذا التطور إلى تجميد خطوط القتال لسنوات وإلغاء فاعلية الهجمات التقليدية، مما أجبر الجيوش على البحث عن تكتيكات وأسلحة جديدة (كالغازات والدبابات والمدافع الرشاشة والخفيفة وقاذفات اللهب) لكسر هذا الجمود الذي استنزف طاقات الدول."},
  {id:"e21",orderIndex:21,category:"الحرب العالمية الأولى",title:"هدنة \"عيد الميلاد\" غير الرسمية بين الجنود",gregorianDate:"25 ديسمبر 1914 م",hijriDate:"7 صفر 1333 هـ",location:"\"الأرض المحايدة\" بين الخنادق المتقابلة على الجبهة الغربية",description:"في ظاهرة استثنائية، اتفق الجنود البريطانيون والألمان بشكل عفوي على وقف إطلاق النار، وخرجوا من خنادقهم ليتقابلوا في المنطقة المحايدة لتبادل التحيات، ودفن الموتى سوياً، ومقايضة الأطعمة، بل ولعبوا كرة القدم معاً.",strategicSignificance:"رغم أنها لم تؤثر على المسار العسكري للحرب واستمرت القيادات في التحذير منها، إلا أنها كشفت عن تطوير الجنود في الخنادق لـ \"قيود على العنف\" ومبدأ \"عش ودع الآخرين يعيشون\"، مما أظهر العبء النفسي الهائل لحرب الخنادق والانفصال بين الجنود والقيادات العليا."},
  {id:"e22",orderIndex:22,category:"الحرب العالمية الأولى",title:"الهجوم الألماني الأول بالغاز السام (معركة إيبر الثانية)",gregorianDate:"22 أبريل 1915 م",hijriDate:"8 جمادى الآخرة 1333 هـ",location:"مدينة إيبر (Ypres)، بلجيكا",description:"في محاولة لكسر جمود حرب الخنادق، استخدم الجيش الألماني الغاز السام ضد خطوط الحلفاء.",strategicSignificance:"أطلق هذا الهجوم شرارة سباق التسلح الكيميائي المحموم بين الدول المتحاربة، مما أضاف أسلحة محملة بالغازات إلى ساحات المعارك، وفرض على الجيوش تطوير وسائل وقاية كأقنعة الغاز."},
  {id:"e23",orderIndex:23,category:"الحرب العالمية الأولى",title:"إقرار الولايات المتحدة لقانون \"الخدمة الانتقائية\" (التجنيد الإلزامي)",gregorianDate:"18 مايو 1917 م",hijriDate:"26 رجب 1335 هـ (تقريباً)",location:"الولايات المتحدة الأمريكية",description:"لعدم كفاية الجيش النظامي الصغير (127 ألف مقاتل) والحرس الوطني، ولإعداد قوات ضخمة للقتال في أوروبا، أقرت الحكومة الأمريكية نظام التجنيد الإلزامي عبر قرعة \"اليانصيب\"، ليتم تسجيل ملايين الشبان وتحويلهم في معسكرات تدريب ضخمة إلى جيش مقاتل.",strategicSignificance:"مكّن هذا التشريع الولايات المتحدة من حشد جيش ضخم تجاوز أربعة ملايين رجل (خَدَم أكثر من مليونين منهم في فرنسا). وقد شكّل هذا الضخ الهائل للقوات الطازجة العامل الذي رجح كفة الحلفاء وأجهض الآمال الألمانية، خاصة خلال الهجمات الحاسمة في خريف 1918."},
  {id:"e24",orderIndex:24,category:"الحرب العالمية الأولى",title:"مجاعة \"شتاء اللفت\"",gregorianDate:"شتاء 1916 - 1917 م (تحديداً أوائل 1917)",hijriDate:"ربيع الأول - ربيع الآخر 1335 هـ",location:"ألمانيا (الجبهة الداخلية)",description:"بسبب الحصار البحري البريطاني الخانق وفشل محصول البطاطا، عانى السكان المدنيون في ألمانيا من نقص حاد في الغذاء. اضطرت العائلات للاعتماد بشكل شبه كلي على \"اللفت\" (الذي كان يُستخدم سابقاً كعلف للحيوانات) كبديل غذائي، مما أدى إلى انتشار سوء التغذية.",strategicSignificance:"أدى هذا النقص الحاد في الحصص الغذائية إلى تدهور خطير في الروح المعنوية الألمانية على الجبهة الداخلية، وزيادة الإضرابات العمالية، وشكل ضغطاً هائلاً على الحكومة الألمانية لاتخاذ قرارات يائسة مثل استئناف \"حرب الغواصات المفتوحة\" لكسر الحصار."},
  {id:"e25",orderIndex:25,category:"الحرب العالمية الأولى",title:"التحاق النساء رسمياً بالقوات المسلحة",gregorianDate:"مارس 1917 م وما بعده",hijriDate:"جمادى الأولى 1335 هـ",location:"بريطانيا والولايات المتحدة الأمريكية",description:"مع تزايد الخسائر البشرية واستنزاف الرجال في الخنادق، بدأت النساء بالالتحاق رسمياً في الجيش البريطاني ضمن \"قوات الاحتياط النسائية\"، وكذلك التحقن في البحرية الأمريكية كعضوات في الحرس الوطني لتولي مهام الدعم الإداري واللوجستي.",strategicSignificance:"مثّل هذا التطور تغييراً جذرياً في تركيبة الجيوش التي كانت تقتصر على الذكور. أثبتت هذه الخطوة الأهمية القصوى لمساهمة المرأة في المجهود الحربي، وهو ما مهّد الطريق لاحقاً لتغيرات اجتماعية كبرى، أبرزها حصول النساء على حق التصويت في عدة دول بعد الحرب."},
  {id:"e26",orderIndex:26,category:"الحرب العالمية الأولى",title:"إدخال سلاح \"قاذف اللهب\" إلى ساحات المعارك",gregorianDate:"عام 1915 م",hijriDate:"1333 هـ",location:"ساحات القتال القريب على الجبهة الغربية",description:"أدخل الجيش الألماني قاذفات اللهب المحمولة كأداة قتالية جديدة. كان السلاح يتطلب فريقاً من جنديين لتشغيله، واستُخدم لتمهيد الطريق أمام وحدات المشاة الهجومية عن طريق إطلاق النيران داخل خنادق العدو ومخابئه من مسافات قريبة.",strategicSignificance:"أضاف هذا السلاح بُعداً نفسياً مرعباً لحرب الخنادق وبث الذعر المباشر في صفوف المدافعين. ورغم محدودية مداه التكتيكي، إلا أنه ساهم في تطوير أساليب \"قوات الصدمة\" لاقتحام التحصينات، وسرعان ما تبنت الجيوش الأخرى أسلحة مشابهة."},
  {id:"e27",orderIndex:27,category:"الحرب العالمية الأولى",title:"تفشي جائحة \"الأنفلونزا الإسبانية\"",gregorianDate:"ربيع عام 1918 م",hijriDate:"رجب - شعبان 1336 هـ",location:"الجبهات العسكرية والمدن على نطاق عالمي",description:"انتشرت سلالة قاتلة من الأنفلونزا كالنار في الهشيم بين الجيوش المتحاربة والمدنيين. سهّلت الخنادق المكتظة، وضعف المناعة بسبب سوء التغذية، وحركة القوات الكثيفة عبر المحيطات، انتقال الفيروس بسرعة غير مسبوقة.",strategicSignificance:"تسببت الجائحة في إضعاف القدرة القتالية للجيوش بشكل حاد واستنزفت الموارد الطبية المنهكة أصلاً. لقد حصدت الجائحة أرواح ملايين البشر (متجاوزةً أعداد من سقطوا في جبهات القتال)، مما سرّع من إنهاك الدول المشاركة وانهيار قدرتها على الاستمرار في الحرب."},
  {id:"e32",orderIndex:32,category:"الحرب العالمية الأولى",title:"ظهور حالات \"صدمة القذيفة\" (Shell Shock)",gregorianDate:"برزت بشكل متزايد منذ عام 1915 م",hijriDate:"1333 هـ وما بعدها",location:"الجبهة الغربية ومصحات العواصم الأوروبية",description:"مع تعرض الجنود لقصف مدفعي ثقيل ومتواصل لأيام وأسابيع، بدأت تظهر حالات انهيار عصبي ونفسي حاد بين المقاتلين. شملت الأعراض الارتجاف المستمر، الشلل، فقدان النطق، والعمى المؤقت دون وجود أي إصابة جسدية مباشرة.",strategicSignificance:"شكّلت هذه الحالة تحدياً هائلاً للقيادات العسكرية التي اعتبرت المصابين في البداية مجرد \"جبناء\" أو متمردين. لكن مع تزايد الأعداد بشكل يهدد قوام الجيوش، اضطرت المؤسسات الطبية للاعتراف بالصدمات النفسية كإصابات حرب حقيقية، مما شكل البداية الفعلية لعلم الطب النفسي العسكري الحديث."},
  {id:"e33",orderIndex:33,category:"الحرب العالمية الأولى",title:"انتشار وباء \"قدم الخندق\" (Trench Foot)",gregorianDate:"شتاء 1914 - 1915 م",hijriDate:"أواخر 1332 - 1333 هـ",location:"خنادق الجبهة الغربية (خاصة في فلاندرز وفرنسا)",description:"بسبب الوقوف الطويل والمستمر للجنود في خنادق مغمورة بالمياه المتجمدة والطين، وعدم قدرتهم على تجفيف أقدامهم أو تبديل جواربهم لأيام، أصيب عشرات الآلاف بتعفن الأنسجة الموضعي وموتها (الغرغرينا).",strategicSignificance:"أدى هذا الوباء إلى خروج أعداد ضخمة من الجنود من الخدمة وعمليات بتر واسعة للأطراف. أُجبرت الجيوش على تغيير روتين الحياة اليومية عبر فرض تفتيش يومي وصارم على أقدام الجنود، وتوزيع \"شحم الحيتان\" لدهن الأقدام كعازل للرطوبة، مما أضاف عبئاً لوجستياً جديداً."},
  {id:"e34",orderIndex:34,category:"الحرب العالمية الأولى",title:"تطور سلاح الطيران والقتال الجوي",gregorianDate:"1915 - 1916 م",hijriDate:"1333 - 1334 هـ",location:"سماء الجبهة الغربية",description:"بعد أن اقتصر دور الطائرات في البداية على مهام الاستطلاع وتصوير الخنادق، تم ابتكار آلية (ألمانية المنشأ) لربط المدافع الرشاشة بحيث تطلق النار من خلال مروحة الطائرة دون تدميرها. أدى ذلك إلى ظهور \"الطائرات المقاتلة\" وبداية المبارزات الجوية المباشرة بين الطيارين.",strategicSignificance:"نقل هذا التطور التكنولوجي ساحة المعركة إلى الجو بشكل فعلي. وأسس لمفهوم \"السيادة الجوية\" كعنصر تكتيكي لا غنى عنه لدعم القوات البرية وتوجيه المدفعية، وهو المفهوم الذي سيطر على العقيدة العسكرية طوال القرن العشرين."},
  {id:"e35",orderIndex:35,category:"الحرب العالمية الأولى",title:"مأسسة الدعاية (البروباغاندا) والرقابة",gregorianDate:"1916 - 1917 م",hijriDate:"1334 - 1335 هـ",location:"الجبهات الداخلية (لندن، برلين، باريس، واشنطن)",description:"أدركت الحكومات المتحاربة خطورة تدفق المعلومات السلبية، فأسست أجهزة صارمة لفرض الرقابة على رسائل الجنود والصحف اليومية. في المقابل، أُطلقت حملات دعاية نفسية مكثفة (عبر الملصقات، والأفلام، والخطابات) لشيطنة العدو، وتبرير التضحيات، وجمع التبرعات لشراء \"سندات الحرب\".",strategicSignificance:"أثبتت هذه الإجراءات أن السيطرة على \"عقول المدنيين\" وحشد الرأي العام لا يقل أهمية عن تسليح الجنود. لقد كرّست الحرب العالمية الأولى استخدام الحرب النفسية كسلاح استراتيجي للحفاظ على استقرار الجبهة الداخلية ومنع انهيارها تحت وطأة الخسائر."},
];

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [figures, setFigures] = useState<HistoryFigure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);
  // Filters
  const [filterCat, setFilterCat] = useState("");
  const [filterImportance, setFilterImportance] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterFigure, setFilterFigure] = useState("");
  const [searchQ, setSearchQ] = useState("");

  // أحداث تاريخية كبرى — تبدأ بالبيانات المضمّنة فوراً
  const [pageTab, setPageTab] = useState<PageTab>("events");
  const [events, setEvents] = useState<HistoricalEvent[]>(WW1_EVENTS);
  const [eventCatFilter, setEventCatFilter] = useState("");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, f] = await Promise.all([
        api.get("/api/history/records"),
        api.get("/api/history/figures"),
      ]);
      setRecords(r.data ?? []);
      setFigures(f.data ?? []);
    } catch {}
    setLoading(false);

    // حاول جلب الأحداث من API (يحل محل البيانات المضمّنة إذا نجح)
    try {
      const { data } = await api.get("/api/historical-events");
      if (Array.isArray(data) && data.length > 0) setEvents(data);
    } catch { /* الـ fallback المضمّن يبقى */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter records
  const filtered = records.filter(r => {
    if (filterCat && r.category !== filterCat) return false;
    if (filterImportance && r.importance !== filterImportance) return false;
    if (filterCountry && r.country !== filterCountry) return false;
    if (filterFigure && r.figure !== filterFigure) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q) && !(r.figure ?? "").toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  // Unique values from data for filters
  const allCategories = [...new Set(records.map(r => r.category).filter(Boolean))] as string[];
  const allImportances = [...new Set(records.map(r => r.importance).filter(Boolean))] as string[];
  const countries = [...new Set(records.map(r => r.country).filter(Boolean))] as string[];
  const allFigures = [...new Set(records.map(r => r.figure).filter(Boolean))] as string[];

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 xl:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>📜 التاريخ والتوثيق</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{records.length} حدث · {figures.length} شخصية</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            + حدث جديد
          </button>
        </div>
        {/* تبويبات */}
        <div className="flex gap-1.5 mt-2">
          {([["events","⚔️ الأحداث الكبرى"],["timeline","📜 الخط الزمني"]] as [PageTab,string][]).map(([k,l]) => (
            <button key={k} onClick={() => setPageTab(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
              style={{ background: pageTab === k ? "#2C2C54" : "var(--bg)", color: pageTab === k ? "#D4AF37" : "var(--muted)", border: `1px solid ${pageTab === k ? "#2C2C54" : "var(--card-border)"}` }}>
              {l} {k === "events" ? `(${events.length})` : `(${records.length})`}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4">

        {/* ═══ الأحداث الكبرى ═══ */}
        {pageTab === "events" && (
          <div className="space-y-4">
            {(<>
              {/* فلتر التصنيف */}
              {(() => {
                const cats = [...new Set(events.map(e => e.category).filter(Boolean))];
                return cats.length > 1 ? (
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setEventCatFilter("")} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                      style={{ background: !eventCatFilter ? "#2C2C54" : "var(--card)", color: !eventCatFilter ? "#D4AF37" : "var(--muted)", border: "1px solid var(--card-border)" }}>الكل</button>
                    {cats.map(c => (
                      <button key={c} onClick={() => setEventCatFilter(c)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                        style={{ background: eventCatFilter === c ? "#2C2C54" : "var(--card)", color: eventCatFilter === c ? "#D4AF37" : "var(--muted)", border: "1px solid var(--card-border)" }}>{c}</button>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* قائمة الأحداث */}
              {events.length > 0 ? (
                <div className="relative">
                  {/* خط زمني عمودي */}
                  <div className="absolute top-0 bottom-0 right-[18px] w-0.5" style={{ background: "linear-gradient(to bottom, #D4AF37, #2C2C54)" }} />

                  <div className="space-y-4">
                    {events.map((ev, idx) => {
                      const isOpen = expandedEvent === ev.id;
                      return (
                        <div key={ev.id} className="relative pr-10">
                          {/* نقطة على الخط الزمني */}
                          <div className="absolute right-[11px] top-4 w-4 h-4 rounded-full border-2 z-10"
                            style={{ background: isOpen ? "#D4AF37" : "var(--card)", borderColor: "#D4AF37" }}>
                            <span className="absolute -right-6 top-0 text-[9px] font-bold" style={{ color: "#D4AF37" }}>{ev.orderIndex}</span>
                          </div>

                          <div className="rounded-2xl border overflow-hidden cursor-pointer transition hover:shadow-md"
                            style={{ background: "var(--card)", borderColor: isOpen ? "#D4AF3740" : "var(--card-border)" }}
                            onClick={() => setExpandedEvent(isOpen ? null : ev.id)}>

                            {/* العنوان */}
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm">⚔️</span>
                                <h3 className="font-bold text-sm flex-1" style={{ color: "var(--text)" }}>{ev.title}</h3>
                                {ev.category && <span className="text-[8px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#2C2C5412", color: "#2C2C54" }}>{ev.category}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {ev.gregorianDate && <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted)" }}>📅 {ev.gregorianDate}</span>}
                                {ev.hijriDate && <span className="text-[10px] flex items-center gap-1" style={{ color: "#D4AF37" }}>🌙 {ev.hijriDate}</span>}
                                {ev.location && <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted)" }}>📍 {ev.location}</span>}
                              </div>
                            </div>

                            {/* التفاصيل (موسّعة) */}
                            {isOpen && (
                              <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "var(--card-border)" }}>
                                {ev.description && (
                                  <div>
                                    <p className="text-[9px] font-bold mb-1" style={{ color: "#2C2C54" }}>📖 الوصف:</p>
                                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{ev.description}</p>
                                  </div>
                                )}
                                {ev.strategicSignificance && (
                                  <div className="rounded-xl p-3" style={{ background: "#D4AF3708", border: "1px solid #D4AF3720" }}>
                                    <p className="text-[9px] font-bold mb-1" style={{ color: "#D4AF37" }}>⚡ الأهمية الاستراتيجية:</p>
                                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{ev.strategicSignificance}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">⚔️</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>لا توجد أحداث تاريخية بعد</p>
                </div>
              )}
            </>)}
          </div>
        )}

        {/* ═══ TIMELINE (الخط الزمني القديم) ═══ */}
        {pageTab === "timeline" && loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {pageTab === "timeline" && !loading && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 بحث..."
                className="px-3 py-2 rounded-xl border text-xs flex-1 min-w-[120px] focus:outline-none"
                style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              {allCategories.length > 0 && (
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الفئات</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {allImportances.length > 0 && (
                <select value={filterImportance} onChange={e => setFilterImportance(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الأهمية</option>
                  {allImportances.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              )}
              {countries.length > 0 && (
                <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الدول</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {allFigures.length > 0 && (
                <select value={filterFigure} onChange={e => setFilterFigure(e.target.value)}
                  className="px-2 py-2 rounded-xl border text-xs focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }}>
                  <option value="">كل الشخصيات</option>
                  {allFigures.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
            </div>

            {/* Eras */}
            <div className="space-y-2">
              {ALL_ERAS.map((era, idx) => {
                const eraRecords = filtered.filter(r => r.year >= era.from && r.year <= era.to);
                if (eraRecords.length === 0 && idx !== CURRENT_CENTURY_IDX) return null;
                return <EraSection key={idx} era={era} records={eraRecords} defaultOpen={idx === CURRENT_CENTURY_IDX} onSelect={setSelected} />;
              })}
            </div>

            {filtered.length === 0 && records.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📜</p>
                <p className="font-bold" style={{ color: "var(--text)" }}>ابدأ بتوثيق التاريخ</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف أول حدث تاريخي</p>
              </div>
            )}
          </>
        )}

        <GeometricDivider />
      </div>

      {/* ═══ MODALS ═══ */}
      {showAdd && <AddRecordModal onClose={() => setShowAdd(false)} onSaved={fetchData} figures={figures} allCategories={allCategories} allImportances={allImportances} countries={countries} />}
      {selected && <RecordDetail record={selected} onClose={() => setSelected(null)} onDelete={() => { api.delete(`/api/history/records/${selected.id}`).catch(() => {}); setSelected(null); fetchData(); }} />}
    </main>
  );
}

/* ─── Era Section (collapsible) ──────────────────────────────────────── */

function EraSection({ era, records, defaultOpen, onSelect }: {
  era: Era; records: HistoryRecord[]; defaultOpen: boolean; onSelect: (r: HistoryRecord) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-right transition"
        style={{ background: "var(--card)" }}>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--muted)" }}>▼</span>
        <span className="text-xs font-bold flex-1" style={{ color: "var(--text)" }}>{era.label}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#5E549515", color: "#5E5495" }}>
          {records.length}
        </span>
      </button>
      {open && records.length > 0 && (
        <div className="border-t px-4 py-2 space-y-1.5" style={{ borderColor: "var(--card-border)" }}>
          {records.map(r => {
            const cc = catColor(r.category);
            const ic = impColor(r.importance);
            return (
              <div key={r.id} onClick={() => onSelect(r)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:shadow-sm transition"
                style={{ background: "var(--bg)" }}>
                <div className="text-center flex-shrink-0 w-14">
                  <p className="text-xs font-black" style={{ color: "#5E5495" }}>
                    {r.day ? `${r.day}/` : ""}{r.month ? `${r.month}/` : ""}{r.year > 0 ? `${r.year}م` : `${Math.abs(r.year)} ق.م`}
                  </p>
                  {r.hijriYear > 0 && <p className="text-[9px]" style={{ color: "var(--muted)" }}>
                    {r.hijriDay ? `${r.hijriDay}/` : ""}{r.hijriMonth ? `${r.hijriMonth}/` : ""}{r.hijriYear}هـ
                  </p>}
                </div>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cc }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{r.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${cc}15`, color: cc }}>{r.category}</span>
                    {r.importance && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${ic}15`, color: ic }}>{r.importance}</span>
                    )}
                    {r.country && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{r.country}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && records.length === 0 && (
        <div className="border-t px-4 py-4 text-center" style={{ borderColor: "var(--card-border)" }}>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>لا توجد أحداث في هذه الحقبة</p>
        </div>
      )}
    </div>
  );
}

/* ─── Record Detail ──────────────────────────────────────────────────── */

function RecordDetail({ record: r, onClose, onDelete }: { record: HistoryRecord; onClose: () => void; onDelete: () => void }) {
  const cc = catColor(r.category);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <div>
            <p className="text-xs" style={{ color: "#5E5495" }}>
              {r.day ? `${r.day}/` : ""}{r.month ? `${r.month}/` : ""}{r.year > 0 ? `${r.year}م` : `${Math.abs(r.year)} ق.م`}
              {r.hijriYear > 0 ? ` / ${r.hijriDay ? `${r.hijriDay}/` : ""}${r.hijriMonth ? `${r.hijriMonth}/` : ""}${r.hijriYear}هـ` : ""}
            </p>
            <h3 className="font-bold text-sm mt-1" style={{ color: "var(--text)" }}>{r.title}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onDelete} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#DC2626", background: "#DC262610" }}>🗑</button>
            <button onClick={onClose} className="text-lg px-1" style={{ color: "var(--muted)" }}>✕</button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${cc}15`, color: cc }}>{r.category}</span>
            {r.importance && <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ background: `${impColor(r.importance)}15`, color: impColor(r.importance) }}>{r.importance}</span>}
          </div>
          {r.description && <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{r.description}</p>}
          {r.strategicImportance && (
            <div className="rounded-lg p-3" style={{ background: "#D4AF3708", border: "1px solid #D4AF3720" }}>
              <p className="text-[10px] font-bold mb-1" style={{ color: "#D4AF37" }}>الأهمية الاستراتيجية</p>
              <p className="text-xs" style={{ color: "var(--text)" }}>{r.strategicImportance}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {r.figure && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>الشخصية:</span> <b style={{ color: "var(--text)" }}>{r.figure}</b></div>}
            {r.location && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>المكان:</span> <b style={{ color: "var(--text)" }}>{r.location}</b></div>}
            {r.country && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>الدولة:</span> <b style={{ color: "var(--text)" }}>{r.country}</b></div>}
            {r.source && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}><span style={{ color: "var(--muted)" }}>المصدر:</span> <b style={{ color: "var(--text)" }}>{r.source}</b></div>}
          </div>
          {r.tags && (
            <div className="flex gap-1 flex-wrap">
              {r.tags.split(",").map(t => <span key={t} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#5E549510", color: "#5E5495" }}>{t.trim()}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Add Record Modal ───────────────────────────────────────────────── */

function AddRecordModal({ onClose, onSaved, figures, allCategories, allImportances, countries }: {
  onClose: () => void; onSaved: () => void; figures: HistoryFigure[];
  allCategories: string[]; allImportances: string[]; countries: string[];
}) {
  const [inputType, setInputType] = useState<"gregorian" | "hijri">("hijri");
  const [yearVal, setYearVal] = useState("");
  const [monthVal, setMonthVal] = useState("");
  const [dayVal, setDayVal] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [figure, setFigure] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("other");
  const [importance, setImportance] = useState("normal");
  const [strategic, setStrategic] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const yearNum = parseInt(yearVal) || 0;
  const converted = inputType === "hijri" ? hijriToGreg(yearNum) : gregToHijri(yearNum);

  async function save() {
    if (!title.trim() || !yearVal) return;
    setSaving(true);
    try {
      const mo = parseInt(monthVal) || undefined;
      const da = parseInt(dayVal) || undefined;
      await api.post("/api/history/records", {
        year: inputType === "gregorian" ? yearNum : hijriToGreg(yearNum),
        month: inputType === "gregorian" ? mo : undefined,
        day: inputType === "gregorian" ? da : undefined,
        hijriYear: inputType === "hijri" ? yearNum : undefined,
        hijriMonth: inputType === "hijri" ? mo : undefined,
        hijriDay: inputType === "hijri" ? da : undefined,
        inputType, title: title.trim(), description: desc.trim() || undefined,
        figure: figure.trim() || undefined, location: location.trim() || undefined,
        country: country.trim() || undefined, category, importance,
        strategicImportance: strategic.trim() || undefined,
        source: source.trim() || undefined, tags: tags.trim() || undefined,
      });
      onSaved(); onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { title?: string } } })?.response?.data?.title;
      alert(`فشل الحفظ${status ? ` (${status})` : ""}${msg ? `: ${msg}` : ""}`);
      console.error("Save history error:", err);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>📜 حدث تاريخي جديد</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
            <button onClick={save} disabled={saving || !title.trim() || !yearVal}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "#2C2C54" }}>
              {saving ? "..." : "حفظ"}
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          {/* Date type */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>نوع التاريخ</label>
            <div className="flex gap-1.5">
              {([["hijri", "هجري"], ["gregorian", "ميلادي"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setInputType(k)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
                  style={{ background: inputType === k ? "#5E5495" : "var(--bg)", color: inputType === k ? "#fff" : "var(--muted)", border: `1px solid ${inputType === k ? "#5E5495" : "var(--card-border)"}` }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {/* Year + conversion */}
          {/* التاريخ: سنة + شهر + يوم */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
              التاريخ {inputType === "hijri" ? "الهجري" : "الميلادي"} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input type="number" value={dayVal} onChange={e => setDayVal(e.target.value)}
                  placeholder="اليوم" min={1} max={30}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none" style={IS} />
                <p className="text-[9px] text-center mt-0.5" style={{ color: "var(--muted)" }}>اليوم</p>
              </div>
              <div>
                <input type="number" value={monthVal} onChange={e => setMonthVal(e.target.value)}
                  placeholder="الشهر" min={1} max={12}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none" style={IS} />
                <p className="text-[9px] text-center mt-0.5" style={{ color: "var(--muted)" }}>الشهر</p>
              </div>
              <div>
                <input type="number" value={yearVal} onChange={e => setYearVal(e.target.value)}
                  placeholder={inputType === "hijri" ? "1445" : "2024"}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-center focus:outline-none" style={IS} />
                <p className="text-[9px] text-center mt-0.5" style={{ color: "var(--muted)" }}>السنة *</p>
              </div>
            </div>
            {yearVal && (
              <p className="text-[10px] mt-1.5 font-medium" style={{ color: "#5E5495" }}>
                = {inputType === "hijri" ? `${converted}م` : `${converted}هـ`}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>العنوان *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الحدث..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الوصف</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="تفاصيل..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={IS} />
          </div>
          {/* Category — free text */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الفئة</label>
            <input value={category} onChange={e => setCategory(e.target.value)} list="cat-list" placeholder="مثال: سياسي، فكري، عسكري..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <datalist id="cat-list">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          {/* Importance — free text with suggestions */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الأهمية</label>
            <input value={importance} onChange={e => setImportance(e.target.value)} list="imp-list" placeholder="مثال: عادي، مهم، فارق..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <datalist id="imp-list">{allImportances.map(i => <option key={i} value={i} />)}</datalist>
          </div>
          {/* Figure */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الشخصية</label>
            <input value={figure} onChange={e => setFigure(e.target.value)} list="figures-list" placeholder="اسم الشخصية..."
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={IS} />
            <datalist id="figures-list">{figures.map(f => <option key={f.id} value={f.name} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>المكان</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="المدينة..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الدولة</label>
              <input value={country} onChange={e => setCountry(e.target.value)} list="country-list" placeholder="الدولة..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
              <datalist id="country-list">{countries.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>الأهمية الاستراتيجية</label>
            <textarea value={strategic} onChange={e => setStrategic(e.target.value)} rows={2} placeholder="لماذا هذا الحدث مهم؟"
              className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={IS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>المصدر</label>
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="اسم الكتاب..."
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>وسوم</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="حروب, فتوحات"
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={IS} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const IS = { borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" };
