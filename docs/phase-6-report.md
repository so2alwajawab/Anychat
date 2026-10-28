# تقرير المرحلة 6 — الردود الخاصة والتحصين الأمني
# Phase 6 Report: Private Replies & Hardening

تاريخ الإنجاز: 2026-10-28  
الحالة: **مكتملة ومُحققة بنجاح 100% (Gate G6 Passed)**  
المسؤول: فريق التطوير — منصة AnyChat  

---

## 1. ملخص تنفيذي (Executive Summary)

تم إنجاز **المرحلة السادسة (Phase 6)** بالكامل وفقاً للمعايير الهندسية والأمنية المحددة في [وثيقة المرحلة 0](file:///c:/Users/11/Desktop/AnyChat/docs/phase-0-architecture-and-feasibility.md). ركزت هذه المرحلة على تمكين أتمتة **الردود الخاصة (Private Replies / Messenger & Instagram Direct)** كإجراء أساسي ومباشر للتعليقات، مع تطبيق كافة سياسات وضوابط منصة Meta الصارمة:
1. **نافذة الرد المحددة بـ 7 أيام (7-Day Policy Window):** منع إرسال أي رد خاص للتعليقات التي مضى عليها أكثر من 7 أيام من تاريخ إنشائها الأصلي (`sourceCreatedAt`)، وتخطي الطلب برمجياً قبل أي اتصال بالشبكة.
2. **قيد الرسالة الواحدة لكل تعليق (One-Message-Per-Comment Constraint):** الالتزام بسياسة Meta بالسماح برسالة خاصة واحدة فقط لكل تعليق عبر قيد فريد في قاعدة البيانات (`private_reply:${targetCommentId}`) يمنع أي تكرار.
3. **محرك إدارة القوالب وتوليد المتغيرات (Template CRUD & Variable Rendering):** دعم القوالب الجاهزة مع استبدال المتغيرات القياسية والتحقق الصارم منها ومنع النشر في حال وجود متغيرات غير مصرح بها.
4. **التغطية الكاملة لسجلات التدقيق الأمني (Audit Log Coverage):** تسجيل كل عملية تعديل حساسة في إعدادات النظام وتدوير المفاتيح مع حجب وإخفاء الأسرار والرموز الحساسة بنسبة 100%.

---

## 2. ما تم إنجازه تفصيلياً

### 2.1 تكامل واجهات الرد الخاص الرسمية (`GraphClient`)
تمت إضافة دوال إرسال الرسائل الخاصة الرسمية في [`apps/api/src/modules/meta/graph.client.ts`](file:///c:/Users/11/Desktop/AnyChat/apps/api/src/modules/meta/graph.client.ts):
- **`sendPagePrivateReply(pageId, pageToken, commentId, message)`**:
  إرسال رسالة خاصة إلى كاتب تعليق على صفحة فيسبوك عبر Meta Messenger Send API:
  `POST /{page-id}/messages` مع تمرير المعاملات المعتمدة:
  `recipient: { comment_id: commentId }` و `message: { text: message }` و `messaging_type: 'RESPONSE'`.
- **`sendInstagramPrivateReply(pageIdOrIgId, pageToken, commentId, message)`**:
  إرسال رسالة خاصة عبر Instagram Messaging API إلى كاتب تعليق على إنستغرام عبر معرف الصفحة المرتبطة بحساب إنستغرام الاحترافي:
  `POST /{page-id}/messages` مع `recipient: { comment_id: commentId }`.

---

### 2.2 محرك تنفيذ الردود الخاصة والضوابط الصارمة (`OutboundService`)
تم تطوير دالة `executePrivateReply` في [`apps/api/src/modules/execution/outbound.service.ts`](file:///c:/Users/11/Desktop/AnyChat/apps/api/src/modules/execution/outbound.service.ts) بالضوابط التالية:
1. **فحص نافذة 7 أيام (Gate G6):**
   حساب عمر التعليق `Date.now() - sourceCreatedAt`. إذا تجاوز 7 أيام (604,800,000 مللي ثانية)، يتم تسجيل حالة `skipped` مع رمز الخطأ `WINDOW_EXPIRED` ورسالة عربية صريحة دون إجراء أي اتصال بشبكة فيسبوك.
2. **قيد الرسالة الواحدة (Gate G6):**
   استخدام مفتاح عدم التكرار `idempotencyKey = 'private_reply:' + targetCommentId` المحمي بقيد فريد مطلق على مستوى جدول `outbound_action`. في حال وجود محاولة ثانية لنفس التعليق، يتم حجبها فورياً دون استدعاء Meta Graph API.
3. **الحيازة الذرية برمز أمان (Claim-before-send with Fencing Token):**
   تحديث الحالة ذرياً من `pending` إلى `sending` برمز فريد يمنع أي عامل (Worker) آخر من تكرار العملية.
4. **ميزانية معدل الرسائل الخاصة (Rate Budgeting):**
   فحص ميزانية الردود الخاصة للحساب عبر Redis (حد أقصى 750 رسالة/ساعة لكل حساب وفق سياسة ميتا الرسمية).
5. **معالجة الانهيار الآمنة (Section 9.4 Crash Reconciliation):**
   في [`apps/api/src/modules/execution/reconciliation.service.ts`](file:///c:/Users/11/Desktop/AnyChat/apps/api/src/modules/execution/reconciliation.service.ts)، تم تخصيص الردود الخاصة العالقة في حالة `sending` بحيث تُعلّم بحالة `unknown` ولا يُعاد إرسالها تلقائياً لتجنب إرسال رسائل خاصة مكررة للمستخدمين.

---

### 2.3 تنفيذ عقد المخططات والمتغيرات (`ExecutionService`)
في [`apps/api/src/modules/execution/execution.service.ts`](file:///c:/Users/11/Desktop/AnyChat/apps/api/src/modules/execution/execution.service.ts):
- دعم تنفيذ العقدة `action.private_reply` سواء باستخدام نص مباشر أو بالربط مع قالب محفوظ (`templateId`).
- دعم كل المتغيرات المصرح بها بالتسمية المزدوجة (صيغة الكائنات والأسماء المبسطة):
  - `{{commenter_name}}` / `{{comment.id}}`
  - `{{comment_text}}` / `{{comment.text}}`
  - `{{page_name}}` / `{{asset.name}}`
  - `{{current_date}}` / `{{now.date}}`
  - `{{post.id}}` / `{{post.permalink}}`
  - `{{workflow.name}}`
- تسجيل الخطوة في `node_execution` بالتفاصيل الكاملة ومخرجات العملية.

---

### 2.4 التحقق من المتغيرات ومنع النشر عند وجود متغيرات غير مصرح بها
في [`packages/shared/src/workflow/validator.ts`](file:///c:/Users/11/Desktop/AnyChat/packages/shared/src/workflow/validator.ts):
- فحص صارم لكافة نصوص العقد (`action.public_reply` و `action.private_reply`).
- منع نشر أو حفظ أي مخطط يحتوي على متغير غير مسجل في القائمة البيضاء (`ALLOW_LISTED_VARIABLES`) مع إظهار رسالة خطأ باللغة العربية توضح المتغير المرفوض والمتغيرات المتاحة.

---

### 2.5 تغطية سجلات التدقيق الأمني للعمليات الحساسة (Audit Log Coverage)
تم التحقق وتأكيد تغطية كافة العمليات الحساسة وتوثيقها في جدول `audit_log` مع حجب تام للأسرار:
1. **حفظ وتدوير سر التطبيق (App Secret):**
   تسجيل الحدث `meta.config.updated` مع مؤشر `secretRotated: true` دون تسجيل السر أبداً.
2. **تعديل رمز التحقق للويب هوك (Verify Token):**
   تسجيل الحدث `meta.config.updated` مع مؤشر `verifyTokenRotated: true`.
3. **ربط وفصل الأصول (OAuth Connect / Disconnect):**
   تسجيل الحدثين `meta.oauth.completed` عند الربط و `meta.asset.deleted` عند الحذف.
4. **تغيير واسترجاع كلمة المرور (Password Reset / Recovery):**
   تسجيل الحدث `owner.password_reset` عبر أمر CLI والحدث `auth.recovery.used` عند استخدام كود الاسترداد، وتدوير أكواد الاسترداد عبر `auth.recovery.code_rotated`.
5. **تدوير مفتاح التشفير (Key Rotation):**
   إضافة أداة CLI مخصصة [`apps/api/src/cli/reencrypt.ts`](file:///c:/Users/11/Desktop/AnyChat/apps/api/src/cli/reencrypt.ts) وأمر `pnpm admin:rotate-key` لإعادة تشفير كافة الأسرار بالاعتماد على المفتاح الأساسي والاحتياطي، وتسجيل الحدث الأمني `crypto.key.rotated` مع ملخص محجوب الأسرار.

---

### 2.6 تحسينات واجهة المستخدم العربية (RTL UI Polish)
في [`apps/web/src/app/(app)/logs/page.tsx`](file:///c:/Users/11/Desktop/AnyChat/apps/web/src/app/(app)/logs/page.tsx):
- إضافة تسميات عربية صريحة للردود الخاصة: «رسالة خاصة ✓»، «رسالة خاصة (رد خاص)».
- ترجمة أنواع العقد في المخطط الزمني التفصيلي:
  - «مشغل البداية (وصول تعليق)»
  - «شرط فحص النص»
  - «شرط فحص الصفحة والمنشور»
  - «رد عام على التعليق»
  - «رد في رسالة خاصة»
  - «استخدام قالب جاهز»
  - «إيقاف المسار»

---

## 3. التحقق من معايير بوابة الانتقال (Gate G6 Criteria Verification)

| معيار بوابة الانتقال (Gate G6) | نتيجة الفحص | الدليل / طريقة التحقق البرمجية |
| :--- | :---: | :--- |
| **1. إرسال الرد الخاص (Private Reply)** | **ناجح ✓** | تم بناء وتأكيد إرسال الردود الخاصة لفيسبوك وإنستغرام عبر `sendPagePrivateReply` و `sendInstagramPrivateReply`. |
| **2. قيد الرسالة الواحدة لكل تعليق (One Message Per Comment)** | **ناجح ✓** | اختبار `one-message-per-comment constraint: second attempt blocked before network call` أكد حظر المحاولة الثانية قبل استدعاء الشبكة تماماً. |
| **3. تطبيق نافذة 7 أيام من تاريخ التعليق** | **ناجح ✓** | اختبار `7-day window guard: comment older than 7 days skips network call with WINDOW_EXPIRED` أكد تخطي التعليق القديم وتوثيق حالة `skipped`. |
| **4. إدارة القوالب وتوليد المتغيرات ومنع النشر عند وجود خطأ** | **ناجح ✓** | اختبارات `validator.spec.ts` (الحالات 16، 17، 21) أكدت رفض المتغيرات غير المصرح بها وقبول المتغيرات الصحيحة. |
| **5. تغطية سجلات التدقيق الأمني للعمليات الحساسة** | **ناجح ✓** | تغطية موثقة لجميع الأحداث (`meta.config.updated`, `meta.oauth.completed`, `meta.asset.deleted`, `owner.password_reset`, `auth.recovery.used`, `crypto.key.rotated`) مع حجب الأسرار بنسبة 100%. |

---

## 4. نتائج الاختبارات وفحص الجودة

- **اختبارات الوحدة (Vitest):** **84 اختباراً ناجحاً 100%** عبر 15 ملف اختبار بدون أي إخفاق.
- **فحص الأنواع (TypeScript Typecheck):** اجتياز تام عبر كافة الحزم `packages/shared`, `apps/api`, `apps/web`.
- **فحص الجودة (Linter):** 0 تحذيرات، 0 أخطاء عبر 92 ملفاً في المشروع.
- **بناء حزم الإنتاج (Production Build):** نجاح تام لجميع المشاريع ومسارات الويب الـ 12.
- **فحص التعريب (Arabic/RTL Verification):** 11 مساراً بنصوص عربية كاملة، 0 نصوص إنجليزية في واجهة المستخدم.
