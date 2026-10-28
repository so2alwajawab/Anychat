# دليل التشغيل: تدوير الأسرار والمفاتيح (Secret Rotation Runbook)

## الهدف
تدوير سر تطبيق Meta (`META_APP_SECRET`)، ورمز التحقق للويب هوك (`META_WEBHOOK_VERIFY_TOKEN`)، ومفتاح التشفير الرئيسي للمنصة (`APP_ENCRYPTION_KEY`) بأمان ودون فقدان البيانات.

---

## 1. تدوير سر تطبيق Meta (App Secret)
1. انتقل إلى لوحة تحكم مطوري فيسبوك (Meta for Developers) -> تطبيقك -> **App Settings** -> **Basic**.
2. اضغط على **Rotate** أو أعد توليد الرمز السري للتطبيق (**App Secret**).
3. افتح صفحة الإعدادات في AnyChat (`https://anychat.egyptcamp.cloud/connections`) أو حدث ملف `deploy/.env`:
   ```bash
   nano deploy/.env
   # قم بتعديل META_APP_SECRET
   ```
4. أعد تشغيل خدمة الواجهة الخلفية لتطبيق التعديل فوراً:
   ```bash
   docker compose -f deploy/compose.yml restart api
   ```
5. يتم تسجيل عملية التدوير تلقائياً في سجل التدقيق الأمني بحساب المالك: `meta.config.updated` مع `secretRotated: true`.

---

## 2. تدوير رمز التحقق للويب هوك (Webhook Verify Token)
1. ولّد رمز تحقق جديد قوي (32 حرفاً عشوائياً):
   ```bash
   openssl rand -hex 16
   ```
2. حدّث الرمز في إعدادات المنصة عبر واجهة `/connections` أو في `deploy/.env`:
   ```bash
   META_WEBHOOK_VERIFY_TOKEN="<الرمز_الجديد>"
   ```
3. توجه إلى إعدادات الويب هوك في لوحة مطوري فيسبوك (Webhooks) واضغط **Edit Subscription**:
   - الصق رابط الويب هوك: `https://anychat.egyptcamp.cloud/api/v1/webhooks/meta`
   - الصق رمز التحقق الجديد واضغط **Verify and Save**.

---

## 3. تدوير مفتاح تشفير البيانات الرئيسي (APP_ENCRYPTION_KEY)
وفق تصميم المرحلة 0، تدعم منصة AnyChat تدوير المفتاح المشفر (Dual-key rotation grace period) بسلاسة:
1. توليد مفتاح جديد مشفر 32 بايت بصيغة base64:
   ```bash
   openssl rand -base64 32
   ```
2. تعيين المفتاح القديم كقيمة في `APP_ENCRYPTION_KEY_OLD` وتعيين المفتاح الجديد في `APP_ENCRYPTION_KEY`:
   ```bash
   APP_ENCRYPTION_KEY="<المفتاح_الجديد>"
   APP_ENCRYPTION_KEY_OLD="<المفتاح_القديم>"
   ```
3. تشغيل أداة إعادة التشفير المدمجة لإعادة تشفير كل الأسرار والرموز المخزنة بالمفتاح الجديد:
   ```bash
   docker compose -f deploy/compose.yml exec api node dist/cli/reencrypt.js
   ```
4. التأكد من نجاح العملية وتسجيل حدث `crypto.key.rotated` في سجل التدقيق الأمني، ثم حذف المفتاح القديم من `APP_ENCRYPTION_KEY_OLD`.
