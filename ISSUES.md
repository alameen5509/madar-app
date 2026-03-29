# تقرير المشاكل الحقيقية — مشروع مدار
**تاريخ الفحص:** 2026-03-29
**المنهج:** فحص فعلي للملفات والكود — لا افتراضات

---

## 🔴 حرج

### 1. بيانات اعتماد مكشوفة في appsettings.json
**الملف:** `backend/src/Madar.API/appsettings.json`
**المشكلة:** كلمة مرور TiDB Cloud وConnection String مكتوبة بشكل صريح في الملف المُرسل لـ GitHub
**الخطر:** أي شخص يصل للـ repo يستطيع الوصول لقاعدة البيانات
**الحل:** نقل الاعتمادات لـ Azure App Settings أو user-secrets

### 2. حقول التذكيرات غير موجودة في EF Model
**الملف:** `backend/src/Madar.Domain/Entities/Core/SmartTask.cs`
**المشكلة:** حقول `ReminderFrequency`, `NextReminderAt`, `SnoozedUntil`, `AssignedPersonName` موجودة في DB (raw SQL) لكن غير معرّفة في Entity
**الأثر:** EF Core لا يعرف هذه الأعمدة — أي Include أو migration قد يتعارض معها
**الحل:** إضافتها للـ Entity أو توثيق أنها raw SQL فقط

---

## 🟡 مهم

### 3. WatchAuthController لا يزال موجودًا رغم حذف الصفحة
**الملف:** `backend/src/Madar.API/Controllers/WatchAuthController.cs`
**المشكلة:** صفحة `/watch-login` حُذفت لكن الـ controller باقٍ
**الحل:** حذف `WatchAuthController.cs`

### 4. ملف .bak منسوخ في Controllers
**الملف:** `backend/src/Madar.API/Controllers/ContactsController.cs.bak`
**المشكلة:** ملف backup لا يجب أن يُرسل للـ repo
**الحل:** حذفه وإضافة `*.bak` للـ .gitignore

### 5. صفحة المهام كبيرة جدًا (3,559 سطر)
**الملف:** `frontend/src/app/tasks/page.tsx`
**المشكلة:** ملف واحد يحتوي على كل منطق أعمال اليوم + التركيز + الجدول + الفلاتر
**الأثر:** صعوبة الصيانة وبطء IDE
**الحل:** تقسيم لمكوّنات (TaskList, FocusSession, PeriodView, etc.)

### 6. 28 catch {} فارغة (tasks + projects)
**tasks/page.tsx:** 17 catch فارغ
**projects/page.tsx:** 11 catch فارغ
**المشكلة:** الأخطاء تُبتلع بصمت — المستخدم لا يعرف ما حدث
**الحل:** إضافة console.error أو toast notification على الأقل

### 7. 18 عنصر في القائمة الجانبية
**الملف:** `frontend/src/components/Sidebar.tsx`
**المشكلة:** كثرة العناصر تجعل القائمة مزدحمة خاصة على الجوال
**الحل:** تجميع في فئات أو إخفاء غير المستخدمة

### 8. Program.cs يحتوي 8 استعلامات ALTER عند كل إقلاع
**الملف:** `backend/src/Madar.API/Program.cs`
**المشكلة:** كل إقلاع للتطبيق ينفّذ 8 ALTER TABLE (idempotent لكن غير ضروري)
**الأثر:** بطء بسيط في الإقلاع
**الحل:** فحص إذا العمود موجود أولاً أو نقلها لـ migration رسمي

---

## 🟢 ثانوي

### 9. localStorage يُستخدم لـ refreshToken
**الملف:** `frontend/src/lib/api.ts` (سطر 24, 40, 50, 202, 227, 237, 245)
**المشكلة:** `refreshToken` في localStorage عرضة لـ XSS
**ملاحظة:** `accessToken` في cookie (أفضل) — لكن refresh في localStorage
**الحل:** نقل refreshToken لـ httpOnly cookie

### 10. Model Snapshot قد لا يتطابق مع DB الفعلي
**المشكلة:** عمليات ALTER يدوية كثيرة (FocusType, SuspendedUntil, reminder columns) بدون migration رسمي
**الأثر:** إذا حاول أحد يشغّل `dotnet ef migrations add` سيجد تعارضات
**الحل:** إنشاء migration "catch-up" يطابق الحالة الحالية

### 11. ملفات publish ضخمة غير مُتتبعة
**الملف:** `backend/src/Madar.API/publish-sc/`, `publish9/`
**المشكلة:** مجلدات publish وzip files ظاهرة في git status (غير مُرسلة لكن مزعجة)
**الحل:** إضافتها للـ .gitignore

---

## ✅ أشياء سليمة (تم التحقق)

- LifeCircleId nullable في كلا الجدولين (Goals + SmartTasks) ✅
- FK constraints = SET NULL (ليس CASCADE أو RESTRICT) ✅
- لا يوجد ربط تلقائي بالدوائر في Create endpoints ✅
- جميع Controllers الـ 33 موجودة ومُسجّلة ✅
- جميع صفحات Frontend الـ 40 موجودة ✅
- API interceptor يتعامل مع 401 ويحاول refresh ✅
- watch-login صفحة محذوفة بشكل صحيح ✅
