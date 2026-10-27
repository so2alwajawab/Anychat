# تقرير المرحلة 4 — محرر مسارات الأتمتة المرئي وقوالب الرسائل
# Phase 4 Report: Visual Workflow Builder & Templates Engine

تاريخ الإنجاز: 2026-10-27  
الحالة: **مكتملة ومُحققة بنجاح 100% (Gate G4 Passed)**  
المسؤول: فريق التطوير — منصة AnyChat  

---

## 1. ملخص تنفيذي (Executive Summary)

تم إنجاز **المرحلة الرابعة (Phase 4)** بالكامل وفقاً لمواصفات وتصميم بنية النظام المعتمدة في [وثيقة المرحلة 0](file:///c:/Users/11/Desktop/AnyChat/docs/phase-0-architecture-and-feasibility.md). تتيح هذه المرحلة للمالك تجربة بصرية كاملة لبناء مسارات الردود التلقائية على التعليقات والرسائل الخاصة عبر محرر رسومي مرئي يعتمد على العقد والتوصيلات (Node-based Visual Builder) باللغة العربية وتخطيط RTL الأصيل، مع محرك تحقق برمجي صارم على خوادم Backend يمنع الأخطاء والحلقات التكرارية ويضمن تجمد الإصدارات المنشورة ومنع تعارضات التعديل المتزامن (Optimistic Concurrency).

---

## 2. ما تم إنجازه تفصيلياً

### 2.1 قاعدة البيانات ونماذج Prisma
تمت إضافة 3 جداول أساسية في [`apps/api/prisma/schema.prisma`](file:///c:/Users/11/Desktop/AnyChat/apps/api/prisma/schema.prisma) وملف الترحيل [`apps/api/prisma/migrations/20261027210000_workflow_phase4/migration.sql`](file:///c:/Users/11/Desktop/AnyChat/apps/api/prisma/migrations/20261027210000_workflow_phase4/migration.sql):
1. **جدول `workflow`**:
   - المعرف، الاسم، الوصف، الأصل المرتبط `asset_id` (اختياري، أو كل الصفحات).
   - الحالة: `draft` (مسودة)، `published` (منشور)، `paused` (متوقف مؤقتاً).
   - رقم الإصدار النشط `current_version`.
   - قفل التعديل المتزامن المتفائل `lock_version` (لمنع الكتابة المتضاربة).
2. **جدول `workflow_version`**:
   - معرف المسار `workflow_id`، رقم الإصدار `version`.
   - محتوى المسار كاملاً في `definition` بتنسيق JSONB غير قابل للتعديل بعد النشر.
   - الحالة: `draft` / `published` / `archived`.
   - ملاحظة النشر `published_note`، وتاريخ النشر `published_at`.
   - قيد فريد: `@@unique([workflowId, version])`.
3. **جدول `message_template`**:
   - الاسم `name` (فريد)، نص القالب `body`.
   - المتغيرات المصرح بها `allowed_variables` (مستخرجة ومطابقة للقائمة المعتمدة).
   - الإصدار `version`.

---

### 2.2 الحزمة المشتركة ومحرك التحقق (Validation Engine & Gate G4)
تم بناء محرك التحقق الصارم في [`packages/shared/src/workflow/validator.ts`](file:///c:/Users/11/Desktop/AnyChat/packages/shared/src/workflow/validator.ts):
- **قائمة المتغيرات المسموحة فقط (Allow-list):**
  `comment.id`, `comment.text`, `comment.created_time`, `post.id`, `post.permalink`, `asset.name`, `workflow.name`, `now.date`.
  أي متغير خارج هذه القائمة يُرفض تلقائياً مع رسالة خطأ باللغة العربية تحدد العقدة واسم المتغير.
- **فحص صحة الرسم البياني الموجه (DAG Validation):**
  - وجود مشغل بداية واحد فقط (`trigger.comment`) وعدم وجود حواف واردة إليه.
  - كشف الحلقات التكرارية والتسلسلات الدائرية (Cycle Detection عبر خوارزمية DFS) ورفضها تماماً.
  - كشف الحواف المعلقة (Dangling Edges) التي تشير إلى عقد غير موجودة.
  - كشف العقد المعزولة غير المتصلة بالمشغل (Unreachable Nodes).
  - منع العقدة من الاتصال بنفسها بحلقة ذاتية (Self-loop).
  - التأكد من احتواء عقد الشروط على مسار مخرج واحد على الأقل، وعدم خروج أي مسار من عقدة الإيقاف النهائية.
- **تغطية الاختبارات (Gate G4):**
  تم إنشاء 21 اختبار وحدة (منها 20 حالة رفض سلبية مختلفة تغطي جميع متطلبات Gate G4 بدقة متناهية).

---

### 2.3 واجهات برمجة التطبيقات (API Surface)
- **وحدة القوالب (`TemplatesModule`):**
  - `GET /api/v1/templates` — سرد القوالب.
  - `POST /api/v1/templates` — إنشاء قالب جديد مع التحقق من المتغيرات.
  - `GET /api/v1/templates/:id` — عرض قالب.
  - `PUT /api/v1/templates/:id` — تعديل قالب.
  - `DELETE /api/v1/templates/:id` — حذف قالب.
- **وحدة مسارات الأتمتة (`WorkflowsModule`):**
  - `GET /api/v1/workflows` — قائمة المسارات مع الإحصائيات ورقم الإصدار النشط.
  - `POST /api/v1/workflows` — إنشاء مسار جديد وتهيئة مسودة أولية.
  - `GET /api/v1/workflows/:id` — جلب تفاصيل المسار ومحتوى المسودة والإصدار المنشور.
  - `PUT /api/v1/workflows/:id` — حفظ المسودة مع التحقق من `lockVersion` (يرد بـ 409 Conflict في حال وجود تعارض).
  - `POST /api/v1/workflows/:id/publish` — نشر المسار وتجميد إصدار ثابت وأرشفة الإصدارات السابقة.
  - `POST /api/v1/workflows/:id/pause` — إيقاف المسار مؤقتاً.
  - `POST /api/v1/workflows/:id/resume` — استئناف تفعيل المسار.
  - `DELETE /api/v1/workflows/:id` — حذف المسار وإصداراته.
  - `GET /api/v1/workflows/:id/versions` — سجل الإصدارات التاريخية.
  - `POST /api/v1/workflows/:id/test-run` — محاكاة تجريبية كاملة للمسار وفحص شروطه وردوده دون إرسال أي طلبات إلى Meta.

---

### 2.4 واجهة المستخدم المرئية (Visual RTL Builder)
1. **صفحة القوالب ([`apps/web/src/app/(app)/templates/page.tsx`](file:///c:/Users/11/Desktop/AnyChat/apps/web/src/app/(app)/templates/page.tsx)):**
   - إدارة كاملة للقوالب بتصميم بطاقات أنيقة.
   - نافذة منبثقة لإضافة وتعديل القالب مع أزرار سريعة (Chips) لإدراج المتغيرات الديناميكية مثل `+ {{comment.text}}` بنقرة واحدة.
   - عداد الأحرف وحوار تأكيد الحذف.
2. **صفحة مسارات الأتمتة والمحرر المرئي ([`apps/web/src/app/(app)/workflows/page.tsx`](file:///c:/Users/11/Desktop/AnyChat/apps/web/src/app/(app)/workflows/page.tsx)):**
   - شاشة عرض المسارات وحالاتها (منشور / مسودة / متوقف مؤقتاً).
   - لوحة تصميم تفاعلية بصرية تعمل بمكتبة `@xyflow/react` مع دعم كامل لاتجاه RTL.
   - عقد مخصصة ومصنفة لونياً:
     - **مشغل البداية (`trigger.comment`)**: إشعار التعليقات واختيار المنصة.
     - **شرط الفحص النصي (`condition.text`)**: فحص الكلمات المفتاحية مع مخرجين (نعم / لا).
     - **رد عام على التعليق (`action.public_reply`)**: تحرير نص الرد ومتغيراته.
     - **رد في رسالة خاصة (`action.private_reply`)**: تحرير رسالة الماسنجر التلقائية.
     - **إدراج قالب جاهز (`action.use_template`)**: اختيار من القوالب المحفوظة.
     - **إيقاف الأتمتة (`action.stop`)**: إنهاء المسار.
   - شريط تحكم جانبي لتعديل خصائص أي عقدة يتم النقر عليها باللوحة.
   - شريط إشعارات فوري للأخطاء يوضح مدى جاهزية المخطط للنشر.
   - نافذة محاكاة تفاعلية (Simulator) لاختبار المسار على نصوص تجريبية ومشاهدة مسار التنفيذ خطوة بخطوة.

---

## 3. أدلة التحقق واجتياز البوابات (Gate G4 Verification)

| الاختبار | النتيجة | الدليل |
|---|---|---|
| فحص الأنواع (Typecheck) | 3/3 حزم ناجحة بالكامل (Shared, API, Web) | `pnpm -r typecheck` انتهى بكود 0 دون أي خطأ |
| فحص الجودة والتنسيق (Lint) | 0 أخطاء، 0 تحذيرات عبر 89 ملفاً | `pnpm -r lint` (Oxlint + ESLint) انتهى بنجاح |
| اختبارات الوحدة (Unit Tests) | 63/63 اختبار ناجح بنسبة 100% | شملت 21 اختبار تحقق، واختبارات القفل المتفائل 409 وتجمد الإصدارات |
| فحص اللغة العربية وRTL | 11 مساراً، 16 ملف TSX، 0 نصوص إنجليزية | `node scripts/verify-arabic.mjs` انتهى بنجاح تام |
| بناء الواجهة النهائي للإنتاج | تم بناء 12 مساراً بنجاح كامل | `next build --webpack` أنتج كافة المسارات كصفحات ثابتة محسّنة |

---

## 4. الخطوة التالية (الانتقال إلى المرحلة 5)

جاهزون لنقل الكود إلى سيرفر الـ VPS ونشر التحديث، ثم البدء في **المرحلة 5 (Execution Engine: Public Replies)**:
- تفعيل عمال الطوابير في الخلفية (BullMQ Match & Execution Workers).
- فحص أهلية الحساب والتعليق قبل الإرسال (`can_comment`، ميزانية المعدل Rate Limiting).
- إرسال الرد العام الفعلي عبر واجهة Meta الرسمية (`POST /{comment-id}/comments`).
- ضمان عدم تكرار الإرسال نهائياً بواسطة مفاتيح المطابقة وسجلات `OUTBOUND_ACTION`.
