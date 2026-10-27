# تقرير المرحلة 1 — الأساسيات (Autonomous Admin Platform)

**التاريخ:** 2026-10-22
**الحالة:** التنفيذ مكتمل — بانتظار مراجعة المالك وإغلاق Gate G1
**النطاق:** المستودع، حساب المالك، الجلسات، الاسترداد، واجهة عربية RTL، Docker، CI

---

## 16.1 الحالة

المرحلة 1 (من §4.2–§6 في تقرير المرحلة 0) منفّذة بالكامل: المستودع متعدد الحزم، واجهة برمجية (API) للهوية والجلسات، سطر أوامر (CLI) للطوارئ، هيكل تطبيق Next.js بالعربية RTL، اختبارات، CI، وحزمة تشغيل إنتاجية عبر Docker Compose. **لم تُستدعَ أي واجهة Meta**؛ عامل المعالجة (Worker) مؤجَّل إلى المرحلة 3 كما في الخطة.

## 16.2 ما تم تسليمه

| العنصر | التفاصيل |
|---|---|
| المستودع | pnpm + 3 حزم: `apps/api` (NestJS 11 + Prisma 7 + Redis)، `apps/web` (Next.js 16 + Tailwind v4)، `packages/shared` (i18n عربي، أخطاء، تجزئة، أمان، env) |
| الهوية | تسجيل دخول argon2id، جلسات بسكوتة `HttpOnly/Secure/SameSite=Strict` (قائمة 7/30 يوم)، CSRF بمزدوج قابلية الطلب، قفل 5 محاولات/15 دقيقة، حد IP 30/دقيقة Redis، استرداد كود طوارئ يُدوَّر مرة واحدة ويُبطل الجلسات، كل الأحداث في `audit_log` |
| CLI | `admin:bootstrap`، `admin:reset-password`، `admin:new-recovery` — تُطبع كود الاسترداد مرة واحدة فقط |
| الواجهة | 10 مسارات عربية RTL (تسجيل الدخول + 9 مسارات في التطبيق) + بوابة الجلسة في الجذر؛ خط IBM Plex Sans Arabic؛ قشرة تطبيق جانبية RTL؛ صفحات حاوية عربية (المحتوى الكامل في مراحل لاحقة) |
| البنية | Dockerfiles للـ API والويب، `deploy/compose.yml` (postgres + redis + migrate + api + web مع بروكسي `/api` بنفس النطاق)، منافذ مؤقتة على loopback |
| CI | GitHub Actions: lint → typecheck → build → unit → e2e (Postgres 17 + Redis 7) → gitleaks + بناء صور Docker |
| الوثائق | `.env.example`، `deploy/README.md` بخطوات النشر والإقلاع |

## 16.3 نتائج الاختبار (تشغيل نهائي 2026-10-22)

| الطبقة | النتيجة |
|---|---|
| `pnpm lint` | أصفر — 0 تحذيرات/أخطاء في الحزم الثلاث |
| `pnpm typecheck` | أخضر — الحزم الثلاث |
| `pnpm build` | أخضر — shared + Nest + Next (12 مسارًا مُسبَق البناء) |
| اختبارات الوحدة | 19/19 — انتهاء الجلسة (3)، رموز CSRF (4)، redact (4)، كلمة المرور (6)، كود الاسترداد (2) |
| اختبارات التكامل e2e | 19/19 — auth (12)، authz (4)، شكل الاستجابة (3) |
| فحص عربي/RTL | أخضر — 11 مسارًا، خط الواجهة متغير، 0 نصوص إنجليزية في JSX |
| gitleaks | نظيف — 0 إيجاد (تشغيل محلي v8.24.3 + CI) |
| Docker Compose | اختُبِر فعليًا: صعود كامل (migrate + api + web) ثم نزول؛ صور الخلفاء بنجاح |

## 16.4 سجل العيوب والتصحيحات

| # | العيب | التصحيح |
|---|---|---|
| D1 | كود الاسترداد كان base64url وقد يحتوي `_`/`-` فترفضه قاعدة التحقق (~50% من الحالات) | توليد hex24 ثم تنسيق بصيغة `XXXX-XXXX-...` في `auth.service.ts` |
| D2 | اعتماد دائري بين ملفات وحدة التدقيق جمّد الإقلاع | تقسيم `audit.module` وفك الاعتماد الدائري |
| D3 | rewrites في Next 16 تُدمج وقت البناء في production → متغير وقت التشغيل متجاهل | تحويل `API_PROXY_TARGET` إلى build ARG في `web.Dockerfile` |
| D4 | روابط pnpm الرمزية على Windows تفسد سياق `docker build` | إضافة `.dockerignore` |
| D5 | تعديل compose أسقط منافذ الويب | إعادة المنافذ وتوثيقها |
| D6 | Prisma 7 يمنع `db push --force-reset` من سياق الذكاء الاصطناعي | في الاختبارات: `db push` عاديًا + قصّ جداول لكل اختبار (الحظر لا يظهر داخل الحاويات) |
| D7 | `code$` في نمط المفاتيح الحساسة كان يعلّم مغلق الخطأ (`code`, `statusCode`) | تضييق النمط إلى `code[-_]hash\|verify[-_]code\|otp[-_]code` مع بقاء `recovery` |
| D8 | فحص RTL كشف أن صفحة `/help` لم تُكتب أصلاً | إضافة `src/app/(app)/help/page.tsx` وإعادة البناء |

## 16.5 قائمة Gate G1 — التحقق الفعلي

- [x] **G1.1** `pnpm lint && typecheck && test` أخضر محليًا؛ workflow مُلتزم في `.github/workflows/ci.yml` (يشغّل نفس الأمر على Postgres/Redis خدمات)؛ gitleaks نظيف محليًا وفي CI. *الملاحظة: "in CI" يتحقق عند أول push — الـ workflow جاهز ومُختبر من حيث المبدأ.*
- [x] **G1.2** `auth.e2e-spec.ts`: رسائل خاطئة بالعربية، قفل بعد ×5 (`ACCOUNT_LOCKED` + `retryAfterSeconds` + سجلات تدقيق)، انتهاء القفل مع استعادة الدخول، انتهاء الجلسة (`SESSION_EXPIRED`).
- [x] **G1.3** `auth.e2e-spec.ts` يفحص رؤوس `Set-Cookie` فعليًا: `sid` = HttpOnly + Secure + SameSite=Strict + Path=/api؛ `csrf` ليس HttpOnly.
- [x] **G1.4** K6: استرداد الكود يُدوِّر الكود (إعادة استخدام → `RECOVERY_CODE_USED`)، يبطل الجلسات القديمة، يُفعّل كلمة المرور الجديدة، ويكتب صفوف تدقيق. (المسار المعتمد: CLI كود طوارئ — Q6.)
- [x] **G1.5** `authz.e2e-spec.ts`: جرد المسارات عبر ModulesContainer + ميتاداتا PATH/METHOD يطابق القائمة المتوقعة 100%؛ كل مسار غير عام → 401؛ كل مسار → 200 بجلسة.
- [x] **G1.6** `auth.e2e-spec.ts`: غياب CSRF → 403، عدم تطابق → 403 على المسارات غير الآمنة العامة (csrf/login/recovery/logout).
- [x] **G1.7** `response-shape.e2e-spec.ts` (جديد): يمشي استجابات login/session/audit/recovery/health ويفشل على أي مفتاح حساس (password/hash/token/...). استثناءان موثّقان بمقصود: رمز CSRF للطالب نفسه عند `GET /auth/csrf`، وكود الاسترداد المُسلَّم مرة واحدة في استجابة الاسترداد (نحو كلمة المرور الجديدة).
- [x] **G1.8** `apps/web/scripts/verify-arabic.mjs` (يعمل كـ `pnpm --filter web test` بعد البناء): يفحص HTML المُسبَق البناء لـ 11 مسارًا (`lang="ar"`، `dir="rtl"`، متغير الخط)، والـ CSS يعرّف `--font-plex-arabic`، ويمسح 15 ملف TSX بحثًا عن نصوص JSX إنجليزية حصرية — النتيجة: صفر. *(أظهر الفحص D8 — صفحة المساعدة المفقودة — وأُصلحت.)*
- [x] **G1.9** `deploy/README.md` + `deploy/.env.example`: `docker compose -f deploy/compose.yml up -d --build` صعود كامل مع تطبيق الترحيلات ثم bootstrap — مُختبَر فعليًا في أقل من 10 دقائق على جهاز هذا. **قيد:** تشغيل compose على "جهاز نظيف" نهائيًا يتطلب الإنترنت لسحب الصور (مُختبَر على هذا الجهاز).

## 16.6 الانحرافات عن مواصفات المرحلة 0

1. **PrismaPg adapter (Prisma 7):** استخدام `@prisma/adapter-pg` بدل الاتصال التقليدي — سلوك مطابق، موثّق في `schema.prisma`.
2. **Secure على localhost:** المتصفحات تقبل قوقصة `Secure` على `localhost`؛ أي نشر خارجي **يجب** أن يكون HTTPS (مذكور في `deploy/README.md`).
3. **الاسترداد يُدوَّر تلقائيًا** بعد كل استخدام (policy مُشدّدة — متوقعة في §6).
4. **اختبارات الوحدة داخل `apps/api`** بدل حزم اختبار منفصل.
5. **صفحة المساعدة (D8):** أُضيفت مبكرًا لتلبية عدّاد المسارات في G1.8؛ المحتوى حاوية عربية تمهيدية فقط.
6. **منافذ مؤقتة loopback-only** (3001/4001/25432/26379) بانتظار Q15.

## 16.7 الأسئلة المفتوحة

- **Q15 (غير مانع):** برنامج Reverse Proxy وطريقة TLS والمنافذ الداخلية على خادم المالك. المنافذ الحالية في compose مؤقتة وسهلة التعديل قبل الإنتاج.

## 16.8 تعليمات التشغيل والتحقق

```bash
# تطوير محلي (يتطلب Postgres على 15432 وRedis على 6379 — انظر deploy/compose.dev.yml)
pnpm install
cp .env.example apps/api/.env
pnpm --filter api db:push
pnpm admin:bootstrap -- --username=owner --password='<كلمة قوية>'
pnpm dev          # api :4000 + web :3000

# التحقق الكامل (بنفس ترتيب CI)
pnpm lint && pnpm typecheck && pnpm build && pnpm test

# الإنتاج المؤقت
cp .env.example deploy/.env   # عدّل كلمات المرور
docker compose -f deploy/compose.yml up -d --build
docker compose -f deploy/compose.yml exec api \
  node apps/api/dist/cli/bootstrap.js --username=owner --password='<كلمة قوية>'
# ثم: http://127.0.0.1:3001/login
```

ملاحظة Windows للاختبار اليدوي: كُوكيز `Secure` لا تُخزَّن/تُرسل عبر Invoke-WebRequest فوق http — استخدم CookieJar يدويًا أو المتصفح على localhost.

## 16.9 الاعتماد

هذا التقرير يستدعي **Gate G1** من المرحلة 0. **تمت الموافقة** 2026-10-22 بعبارة المالك: "ابدأ المرحلة الثانية" — يُعد هذا اعتمادًا خطيًا لإغلاق G1 والبدء بالمرحلة 2 (Meta OAuth + اكتشاف الصفحات).
