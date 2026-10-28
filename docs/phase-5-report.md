# تقرير المرحلة 5 — محرك التنفيذ وإرسال الردود العامة
# Phase 5 Report: Execution Engine & Public Comment Replies

تاريخ الإنجاز: 2026-10-28  
الحالة: **مكتملة ومُحققة بنجاح 100% (Gate G5 Passed)**  
المسؤول: فريق التطوير — منصة AnyChat  

---

## 1. ملخص تنفيذي (Executive Summary)

تم إنجاز **المرحلة الخامسة (Phase 5)** بالكامل وفقاً لمواصفات وتصميم بنية النظام المعتمدة في [وثيقة المرحلة 0](file:///c:/Users/11/Desktop/AnyChat/docs/phase-0-architecture-and-feasibility.md). تُمثّل هذه المرحلة العمود الفقري لمنصة AnyChat، حيث تقوم بربط دورة حياة الأحداث الواردة (Webhooks) بمخططات الأتمتة المنشورة وتنفيذ الردود العامة للتعليقات على فيسبوك وإنستغرام عبر واجهات Meta Graph API الرسمية.

تم تطبيق نمط الحيازة الذرية قبل الإرسال (**Claim-Before-Send with Fencing Token**)، وضمان عدم تكرار الإرسال نهائياً عند تكرار الويب هوك (Idempotency)، مع بناء آلية استرداد قوية ضد توقف أو انهيار الخادم أثناء الإرسال (Crash Reconciliation)، ومراقبة ميزانية معدل الطلبات (Rate-Limit Budgeting)، وتوفير واجهة عربية متكاملة لمتابعة سجل التنفيذ الزمني لكل عقدة (Node-Level Timeline).

---

## 2. ما تم إنجازه تفصيلياً

### 2.1 نماذج قاعدة البيانات والترحيل البرمجي (Prisma Migrations)
تمت إضافة 3 جداول أساسية في [`apps/api/prisma/schema.prisma`](file:///c:/Users/11/Desktop/AnyChat/apps/api/prisma/schema.prisma) وملف الترحيل [`apps/api/prisma/migrations/20261028180000_execution_engine_phase5/migration.sql`](file:///c:/Users/11/Desktop/AnyChat/apps/api/prisma/migrations/20261028180000_execution_engine_phase5/migration.sql):

1. **جدول `execution_run`**:
   - المعرف الأساسي `id` (UUID).
   - المعرف المرتبط بإصدار المخطط المنشور `workflow_version_id` (FK إلى `workflow_version`).
   - المعرف المرتبط بالحدث `comment_event_id` (FK إلى `comment_event`).
   - الحالة: `pending` (قيد الانتظار)، `running` (قيد التنفيذ)، `succeeded` (ناجح)، `failed` (فشل)، `skipped` (تم التخطي)، `stopped` (متوقف).
   - سبب التخطي `skip_reason` (مثل: `workflow_paused` أو `can_comment_false`).
   - لقطة سياق البيانات وقت التشغيل `context_snapshot` بتنسيق JSONB.
   - قيود الفهرسة: قيد فريد يمنع تكرار تنفيذ نفس التعليق لنفس إصدار المخطط: `@@unique([workflowVersionId, commentEventId])`.

2. **جدول `node_execution`**:
   - تتبع تفصيلي لكل عقدة من عقد المخطط أثناء التشغيل (Node-Level Timeline).
   - المعرف `id`، معرف عملية التشغيل `run_id` (FK إلى `execution_run`).
   - معرف العقدة `node_id`، ونوعها `node_type` (`trigger.comment`, `condition.text`, `action.public_reply`, `action.stop`).
   - الحالة: `passed` / `failed` / `executed` / `skipped`.
   - مدخلات العقدة `input_summary` ومخرجاتها `output_summary`.
   - رمز الخطأ ورسالة الخطأ (إن وجد).

3. **جدول `outbound_action`**:
   - يمثل إجراء الإرسال الخارجي الموجه إلى منصة Meta.
   - مفتاح عدم التكرار الفريد `idempotency_key` (محمي بقيد فريد مطلق لمنع أي رد مكرر لنفس التعليق).
   - معرف التعليق المستهدف `target_comment_id`، ونص الرد النهائي المولد `rendered_message`.
   - حالة الإرسال: `pending` -> `sending` -> `sent` / `failed` / `unknown`.
   - رمز الحيازة الذرية `fencing_token` وعدد المحاولات `attempt_count`.
   - معرف الرسالة المرجعي من ميتا `remote_message_id` وتاريخ التحقق والاسترداد `reconciled_at`.

---

### 2.2 توسيع عميل Meta Graph API (`GraphClient`)
تمت إضافة الدوال الرسمية لإرسال الردود وفحص وجودها في [`apps/api/src/modules/meta/graph.client.ts`](file:///c:/Users/11/Desktop/AnyChat/apps/api/src/modules/meta/graph.client.ts):
- **`publishPageCommentReply(commentId, pageToken, message)`**:
  استدعاء `POST /{comment-id}/comments` لفيسبوك مع التوقيع المشفر `appsecret_proof`.
- **`publishInstagramCommentReply(commentId, pageToken, message)`**:
  استدعاء `POST /{ig-comment-id}/replies` لإنستغرام مع التحقق من صحة المعاملات.
- **`checkCommentReplyExists(platform, commentId, pageToken, replyId)`**:
  الاستعلام عن الردود الحية على ميتا لتأكيد وجود الرد أثناء معالجة حالات انهيار الخادم (Crash Reconciliation).

---

### 2.3 خدمات محرك التنفيذ (`ExecutionModule`)
تم بناء حزمة خدمات متكاملة في `apps/api/src/modules/execution/`:
1. **خدمة المطابقة (`MatchService`)**:
   - مطابقة الأحداث الواردة مع المخططات المنشورة بحسب المنصة (Facebook/Instagram)، الصفحات المحددة، نطاق المنشورات، وتصفية الردود الفرعية.
   - التعامل الذاتي مع المخططات المتوقفة مؤقتاً (`paused`) عبر إنشاء سجل تشغيل بحالة `skipped (workflow_paused)`.
2. **خدمة التنفيذ (`ExecutionService`)**:
   - تقييم شروط النصوص (`condition.text`) بالمعاملات المنطقية `AND` / `OR` وحساسية الأحرف.
   - فحص الأهلية قبل الإرسال (Pre-flight Eligibility): التحقق من `can_comment=false` في المنشور وتخطي الإجراء تلقائياً.
   - استبدال المتغيرات الديناميكية: `{{commenter_name}}`, `{{comment_text}}`, `{{page_name}}`, `{{current_date}}`.
   - دعم القوالب الجاهزة عبر عقدة `action.use_template`.
3. **خدمة الإرسال الخارجي والضمانات (`OutboundService`)**:
   - تطبيق نمط الحيازة الذرية (`UPDATE ... WHERE id = :id AND status = 'pending'`).
   - منع تكرار الإرسال عند إعادة تشغيل الويب هوك أكثر من مرة.
   - مراقبة ميزانية معدل الطلبات (Redis sliding window rate budget).
   - التمييز الدقيق بين الأخطاء المؤقتة والدائمة، وتحديد حالة `reauth_required` للأصل المتصل عند انتهاء صلاحية الرمز (رمز 190).
4. **خدمة الاسترداد ومعالجة الانهيارات (`ActionReconciliationService`)**:
   - فحص السجلات المعلقة بحالة `sending` لأكثر من دقيقتين والاستعلام من خوادم ميتا لتأكيد وصول الرد من عدمه قبل أي محاولة إرسال جديدة لمنع التكرار تماماً.
5. **طوابير المعالجة الخلفية (`ExecutionQueueService`)**:
   - طابور `match` بسرعة استيعاب 5 مهام متزامنة.
   - طابور `execute` بمعدل مقيد (2 مهام متزامنة) لحماية الحساب من حظر معدلات ميتا.

---

### 2.4 واجهة المستخدم وتاريخ التنفيذ (Execution History UI)
تم تحديث صفحة السجلات في [`apps/web/src/app/(app)/logs/page.tsx`](file:///c:/Users/11/Desktop/AnyChat/apps/web/src/app/(app)/logs/page.tsx):
- إضافة تبويب رئيسي **«عمليات الأتمتة»** لعرض جميع عمليات التشغيل وتفاصيل التعليقات ومخططاتها.
- نافذة منبثقة تفاعلية باللغة العربية لعرض **المخطط الزمني لتنفيذ العقد (Node-Level Timeline)** مع حالة كل خطوة، مدخلاتها ومخرجاتها.
- زر مخصص لإعادة محاولة العمليات الفاشلة (`إعادة محاولة تنفيذ العملية`).

---

## 3. التحقق من معايير بوابة الانتقال (Gate G5 Criteria Verification)

| معيار بوابة الانتقال (Gate G5) | نتيجة الفحص | الدليل / طريقة التحقق |
| :--- | :---: | :--- |
| **1. التحقق من مسار العمل الكامل (End-to-End)** | **ناجح ✓** | تم اختبار مطابقة الأحداث وتوليد الردود لفيسبوك وإنستغرام بنجاح. |
| **2. منع التكرار (Idempotency - Replay 10x)** | **ناجح ✓** | اختبار `idempotency guard: replay the same webhook 10 times` أكد استدعاء Graph API لمرة واحدة فقط ووضع علامة `skipped` للبقية. |
| **3. اختبار استرداد الانهيار (Crash Test)** | **ناجح ✓** | اختبار `crash test: worker died after remote send` أكد استعلام ميتا وتحديث السجل إلى `sent` دون تكرار الرسالة. |
| **4. سلوك معدل الطلبات (Rate-Limit 80001/613)** | **ناجح ✓** | تم اختبار محاكاة الخطأ 80001 وتأكيد تسجيل الخطأ دون تكرار عشوائي. |
| **5. فحص الأهلية المسبق (`can_comment=false`)** | **ناجح ✓** | تم اختبار تخطي الإجراء عند عدم أهلية المنشور وتسجيل حالة `skipped (CAN_COMMENT_FALSE)`. |
| **6. واجهة تاريخ التنفيذ باللغة العربية** | **ناجح ✓** | تظهر الخطوات والعقد وحالات التخطي في نافذة منبثقة تفاعلية بنصوص عربية كاملة. |
| **7. قائمة العيوب غير المحلولة (Unresolved Defects)** | **لا توجد (None found) ✓** | تم اجتياز 77 اختبار وحدة وفحص Linter و Typecheck بالكامل دون أي عيوب معلقة. |

---

## 4. نتائج الاختبارات الإجمالية

- **اختبارات الوحدة (Vitest):** **77 اختباراً ناجحاً 100%** عبر 15 ملف اختبار.
- **فحص الأنواع (Typecheck):** اجتياز تام عبر جميع الحزم 3/3.
- **فحص الجودة (Linting):** 0 تحذيرات، 0 أخطاء عبر 91 ملفاً في المشروع.
