# دليل التشغيل: التراجع في حالات الطوارئ (Rollback Runbook)

## الهدف
إعادة النظام فوراً إلى الإصدار السابق المستقر في حال حدوث خطأ حرج غير متوقع بعد نشر إصدار جديد.

---

## خطوات التراجع

### 1. تحديد الالتزام السابق المستقر (Commit Hash)
```bash
cd /root/anychat
git log --oneline -n 5
```

### 2. الرجوع للالتزام المستقر
```bash
# استبدال <STABLE_COMMIT_HASH> بالرمز السابق المستقر
git checkout <STABLE_COMMIT_HASH>
```

### 3. إعادة بناء وتشغيل الحاويات على الإصدار المستقر
```bash
docker compose -f deploy/compose.yml up -d --build
```

### 4. معالجة ترحيلات قاعدة البيانات (إن وجدت ترحيلات عكسية)
في منصة AnyChat، تُصمم جميع الترحيلات بسياسة **Additive-first** (عدم حذف أو تعديل الأعمدة بشكل مدمر)، مما يضمن التوافق التراجعي. في حال الحاجة لوضع علامة على ترحيل تم التراجع عنه:
```bash
docker compose -f deploy/compose.yml exec api node node_modules/prisma/build/index.js migrate resolve --rolled-back "<migration_name>"
```

### 5. التحقق من سلامة الخدمة بعد التراجع
```bash
docker compose -f deploy/compose.yml ps
curl -I http://127.0.0.1:4001/healthz
curl -I https://anychat.egyptcamp.cloud/login
```
