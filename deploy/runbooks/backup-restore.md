# دليل التشغيل: النسخ الاحتياطي واستعادة البيانات (Backup & Restore Runbook)

## الهدف
جدولة النسخ الاحتياطي التلقائي لقاعدة بيانات PostgreSQL، ومزامنتها سحابياً إلى Google Drive عبر rclone، وإجراء مناورات استعادة دورية للتحقق من سلامة البيانات وقياس مدة الاستعادة.

---

## 1. جدولة النسخ الاحتياطي اليومي عبر Cron
على خادم VPS، يتم إعداد مهمة Cron يومية تعمل في تمام الساعة 03:00 فجراً بتوقيت الخادم:

```bash
# فتح جدول المهام المجدولة
crontab -e

# إضافة السطر التالي:
0 3 * * * /root/anychat/deploy/scripts/backup.sh >> /root/anychat/backups/cron.log 2>&1
```

يقوم هذا السكربت بـ:
1. أخذ نسخة احتياطية مضغوطة بتنسيق Custom format (`pg_dump -Fc`).
2. حفظ النسخة في مسار `/root/anychat/backups/anychat_YYYYMMDD_HHMMSS.dump`.
3. تطبيق سياسة الحفظ المتدحرج لـ 30 يوماً وحذف النسخ الأقدم تلقائياً.
4. المزامنة إلى Google Drive في حال إعداد rclone.

---

## 2. إجراء مناورة استعادة تجريبية (Restore Drill - Gate G7)
للتحقق من سلامة النسخ الاحتياطي والقدرة على الاستعادة دون التأثير على قاعدة البيانات الحية:

```bash
# تشغيل مناورة الاستعادة
/root/anychat/deploy/scripts/restore-drill.sh
```

أو عبر أمر Node.js الشامل المدمج:
```bash
docker compose -f deploy/compose.yml exec api node dist/cli/backup-drill.js
```

### ما يتم فحصه أثناء المناورة:
- إنشاء قاعدة بيانات مؤقتة معزولة (`anychat_drill_test`).
- قياس وقت الاستعادة الدقيق بالثواني والمللي ثانية.
- التأكد من استعادة جميع الجداول الـ 17 بدون أي خطأ هيكلي (0 Schema Defects).
- التحقق من تكامل المفاتيح الأجنبية والارتباطات بين الجداول.
- تنظيف وحذف قاعدة البيانات المؤقتة بعد انتهاء الفحص.
- تسجيل إتمام المناورة في سجل التدقيق الأمني.

---

## 3. استعادة قاعدة البيانات في حالات الكوارث (Full Disaster Recovery)
في حال تعطل الخادم بالكامل، أو الحاجة لنقل المنصة إلى خادم جديد:

### الخطوات:
1. تجهيز الخادم الجديد وتثبيت Docker و Docker Compose.
2. استنساخ المستودع:
   ```bash
   git clone https://github.com/so2alwajawab/Anychat.git /root/anychat
   cd /root/anychat
   ```
3. نقل ملف البيئة المحفوظ `deploy/.env` (يجب أن يحتوي على نفس `APP_ENCRYPTION_KEY` لفك تشفير رموز الصفحات).
4. تشغيل قاعدة البيانات:
   ```bash
   docker compose -f deploy/compose.yml up -d postgres redis
   ```
5. استعادة ملف النسخة الاحتياطية:
   ```bash
   /root/anychat/deploy/scripts/restore.sh /path/to/anychat_YYYYMMDD.dump
   ```
6. تشغيل باقي خدمات المنصة:
   ```bash
   docker compose -f deploy/compose.yml up -d --build
   ```
7. فحص الجاهزية وتسجيل الدخول للتأكد من عودة جميع البيانات والمخططات المنشورة كما كانت.
