# دليل التشغيل: النشر والتحديث (Deploy Runbook)

## الهدف
نشر إصدار جديد من AnyChat على خادم الإنتاج (VPS) بدون انقطاع في الخدمة ومع تطبيق ترحيلات قاعدة البيانات بأمان.

---

## متطلبات التشغيل المسبقة
- وصول SSH بصلاحيات root أو sudo إلى خادم VPS (`srv1860035`).
- مسار المشروع على الخادم: `/root/anychat`.
- توفر ملف البيئة المحمي `deploy/.env`.

---

## خطوات النشر القياسية

### 1. الدخول إلى مجلد المشروع وسحب آخر التحديثات
```bash
cd /root/anychat
git fetch origin main
git status
git pull origin main
```

### 2. مراجعة المتغيرات وتحديث الحزم (إن لزم)
```bash
# التأكد من صحة deploy/.env
ls -la deploy/.env
```

### 3. بناء وإعادة تشغيل الخدمات عبر Docker Compose
```bash
docker compose -f deploy/compose.yml up -d --build
```
> **ملاحظة:** ستقوم خدمة `migrate` تلقائياً بتطبيق أي ترحيلات برمجية جديدة (`prisma migrate deploy`) قبل تشغيل حاوية `api`.

### 4. التحقق من صحة وجاهزية الخدمات (Health Verification)
```bash
# فحص حالة الحاويات
docker compose -f deploy/compose.yml ps

# فحص جاهزية الخادم الخلفي
curl -I http://127.0.0.1:4001/healthz
curl -s http://127.0.0.1:4001/readyz

# فحص واجهة المستخدم
curl -I http://127.0.0.1:3001/login

# فحص سجلات التشغيل
docker compose -f deploy/compose.yml logs api --tail 50
docker compose -f deploy/compose.yml logs web --tail 50
```

### 5. التحقق من وصول النطاق الخارجي عبر HTTPS
```bash
curl -I https://anychat.egyptcamp.cloud/login
```
يجب أن ترجع الاستجابة كود `200 OK`.
