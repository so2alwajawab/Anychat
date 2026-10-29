"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/api";

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getSession()
      .then((s) => setIsLoggedIn(Boolean(s)))
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafc] text-slate-900 selection:bg-[#ff1212] selection:text-white relative overflow-hidden font-sans">
      {/* Subtle Background Glows & Polished Gradient Orbs */}
      <div className="absolute top-0 right-1/4 -z-10 h-[550px] w-[550px] rounded-full bg-gradient-to-tr from-rose-200/40 via-red-100/30 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-10 -z-10 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-100/40 via-purple-100/30 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 -z-10 h-[450px] w-[450px] rounded-full bg-rose-100/50 blur-3xl pointer-events-none" />

      {/* Modern Dots/Grid Pattern */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e2e4ea_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo with Official Brand Image */}
          <Link href="/" className="flex items-center gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="AnyChat Logo"
              width={512}
              height={414}
              className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Navigation links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#features" className="hover:text-[#ff1212] transition">المميزات الرئيسية</a>
            <a href="#how-it-works" className="hover:text-[#ff1212] transition">طريقة العمل</a>
            <a href="#stats" className="hover:text-[#ff1212] transition">إحصائيات ونتائج</a>
            <a href="#faq" className="hover:text-[#ff1212] transition">الأسئلة الشائعة</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-2xl bg-gradient-to-r from-[#ff1212] to-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#ff1212]/20 hover:shadow-lg hover:shadow-[#ff1212]/30 hover:scale-[1.02] transition"
              >
                لوحة التحكم الرئيسية 🚀
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/signup"
                  className="rounded-2xl bg-gradient-to-r from-[#ff1212] to-rose-600 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#ff1212]/20 hover:shadow-lg hover:shadow-[#ff1212]/30 hover:scale-[1.02] transition"
                >
                  إنشاء حساب جديد
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Floating Category Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/90 px-4 py-1.5 text-xs font-bold text-rose-700 shadow-xs mb-8 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-[#ff1212] animate-ping" />
          <span>المنصة الرائدة والأولى عربياً لأتمتة فيسبوك وإنستغرام الذكية</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-tight sm:leading-none max-w-5xl mx-auto">
          حوّل كل تعليق إلى <span className="text-[#ff1212] relative inline-block">
            مبيعة مؤكدة
            <span className="absolute left-0 bottom-1 w-full h-3 bg-red-200/50 -z-10 rounded-sm -rotate-1" />
          </span> في أقل من 3 ثوانٍ
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
          نظام متكامل يتيح لك الرد على استفسارات الأسعار تلقائياً في التعليقات مع إعجاب فوري، وإرسال رسائل خاصة بالماسنجر والدايركت تتضمن تفاصيل العرض وأزرار الشراء والمحادثة عبر واتساب فورياً.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ff1212] to-rose-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#ff1212]/25 hover:shadow-2xl hover:shadow-[#ff1212]/35 hover:scale-105 transition transform cursor-pointer"
          >
            <span>ابدأ الآن مجاناً</span>
            <span className="text-lg">←</span>
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-8 py-4 text-base font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition"
          >
            <span>شاهد كيف يعمل النظام 🎥</span>
          </a>
        </div>

        {/* Trust Badges Row */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm font-bold text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span>
            <span>ربط رسمي وآمن عبر Meta Graph API</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span>
            <span>بدون الحاجة لبطاقة بنكية للتجربة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">✓</span>
            <span>حماية كاملة من حظر الصفحات (Anti-Spam)</span>
          </div>
        </div>

        {/* Interactive App Window Showcase (Light & Polished Theme) */}
        <div className="mt-16 relative rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xl shadow-slate-200/60 max-w-5xl mx-auto">
          {/* macOS Style Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-400 font-bold mr-2">{"AnyChat Flow Builder"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                المسار متصل ونشط على مدار الساعة
              </span>
            </div>
          </div>

          {/* Interactive Flow Visual Layout */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-rose-50/20 p-5 sm:p-8 border border-slate-100 text-start">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
              {/* Step 1: Trigger */}
              <div className="rounded-2xl border-2 border-amber-300 bg-white p-5 shadow-sm space-y-3 relative hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 border border-amber-200">
                    الخطوة 1: عند البدء
                  </span>
                  <span className="text-base">⚡</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">تعليق العميل على المنشور</h4>
                  <p className="text-[11px] text-slate-500 mt-1">التقاط الكلمات المفتاحية مثل (سعر، كام، تفاصيل، كود الخصم).</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] font-semibold text-slate-700 border border-slate-100 flex items-center justify-between">
                  <span>إعجاب فوري بالتعليق:</span>
                  <span className="text-emerald-600 font-bold">مفعل 👍</span>
                </div>
              </div>

              {/* Step 2: Public Reply */}
              <div className="rounded-2xl border-2 border-emerald-300 bg-white p-5 shadow-sm space-y-3 relative hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 border border-emerald-200">
                    الخطوة 2: رد عام ذكي
                  </span>
                  <span className="text-base">💬</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">الرد التلقائي في التعليقات</h4>
                  <p className="text-[11px] text-slate-500 mt-1">تنويع عشوائي بين 4 صيغ مختلفة لحماية الحساب من قيود الخوارزميات.</p>
                </div>
                <div className="rounded-xl bg-emerald-50/70 p-2.5 text-[11px] font-medium text-emerald-900 border border-emerald-100">
                  &ldquo;أهلاً بك يا أحمد، تم إرسال تفاصيل الخصم في رسالة خاصة لحضرتك!&rdquo;
                </div>
              </div>

              {/* Step 3: Private Reply */}
              <div className="rounded-2xl border-2 border-blue-400 bg-white p-5 shadow-sm space-y-3 relative hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 border border-blue-200">
                    الخطوة 3: رسالة خاصة تفاعلية
                  </span>
                  <span className="text-base">📩</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">رسالة الماسنجر أو الدايركت</h4>
                  <p className="text-[11px] text-slate-500 mt-1">تتضمن صورة العرض، كود الخصم، وأزرار تفاعلية للنقر الفوري.</p>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 py-1.5 text-xs font-bold text-blue-800 shadow-2xs">
                    <span>🔗</span>
                    <span>شراء المنتج الآن بنقرة واحدة</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs">
                    <span>💬</span>
                    <span>محادثة واتساب مع فريق المبيعات</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Numbers / Stats Banner */}
      <section id="stats" className="border-y border-slate-200 bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="p-4">
            <div className="text-4xl sm:text-6xl font-black text-slate-900 font-mono tracking-tight">&lt; 3s</div>
            <div className="text-xs sm:text-sm font-bold text-slate-500 mt-2">سرعة إرسال الرد العام والخاص</div>
          </div>
          <div className="p-4">
            <div className="text-4xl sm:text-6xl font-black text-[#ff1212] font-mono tracking-tight">100%</div>
            <div className="text-xs sm:text-sm font-bold text-slate-500 mt-2">ردود على جميع التعليقات والمنشورات</div>
          </div>
          <div className="p-4">
            <div className="text-4xl sm:text-6xl font-black text-amber-500 font-mono tracking-tight">3.5x</div>
            <div className="text-xs sm:text-sm font-bold text-slate-500 mt-2">مضاعفة نسبة تحويل العملاء لمبيعات</div>
          </div>
          <div className="p-4">
            <div className="text-4xl sm:text-6xl font-black text-emerald-600 font-mono tracking-tight">24 / 7</div>
            <div className="text-xs sm:text-sm font-bold text-slate-500 mt-2">عمل آلي مستمر بدون توقف</div>
          </div>
        </div>
      </section>

      {/* Comprehensive Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#ff1212] bg-red-50 border border-red-200 px-3 py-1 rounded-full inline-block mb-3">
            المميزات الحصرية المتطورة
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">كل الأدوات التي تحتاجها للسيطرة على مبيعات السوشيال ميديا</h2>
          <p className="mt-3 text-sm text-slate-500">تم بناء كل تفصيلة لتوفر أعلى عائد على استثمارك الإعلاني بأسهل تجربة استخدام عربية.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs hover:shadow-xl hover:border-red-300 transition duration-300 group">
            <div className="h-14 w-14 rounded-2xl bg-red-50 text-[#ff1212] flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
              🎨
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">محرر مسارات بصري متقدم</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              صمم مسارات الردود التلقائية عبر لوحة بصرية سهلة (Visual Flow Builder). اربط العقد بالسحب والإفلات مع دعم كامل لترتيب العقد تلقائياً (Auto-Layout).
            </p>
          </div>

          {/* Feature 2 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs hover:shadow-xl hover:border-blue-300 transition duration-300 group">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
              🔘
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">أزرار تفاعلية بالرسائل الخاصة</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              ادعم رسائلك بأزرار تفاعلية حقيقية (Action Buttons): توجيه العميل لصفحة المتجر، بدء محادثة واتساب فورية مع خدمة العملاء، أو الاتصال برقم هاتفك مباشرة.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs hover:shadow-xl hover:border-emerald-300 transition duration-300 group">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
              👍
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">الإعجاب التلقائي بالتعليقات</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              تفاعل فوري يضع إعجاباً باسم صفحتك على تعليق العميل فور كتابته، مما يرفع تقييم التفاعل (Engagement Rate) ويحفز الخوارزميات على نشر المنشور لجمهور أوسع.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs hover:shadow-xl hover:border-purple-300 transition duration-300 group">
            <div className="h-14 w-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
              🎲
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">تنويع الردود ضد الحظر (Anti-Spam)</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              أضف حتى 5 صيغ مختلفة للرد العام، ليقوم المحرك باختيار صيغة عشوائية لكل عميل، مما يمنع حظر الصفحة أو تقييد الردود من قِبل ميتا نهائياً.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs hover:shadow-xl hover:border-rose-300 transition duration-300 group">
            <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
              ⛔
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">استبعاد الكلمات السلبية</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              فلترة ذكية تمنع تشغيل الأتمتة فوراً إذا احتوى التعليق على كلمات سلبية أو شكاوى (مثل: &ldquo;نصابين&rdquo;، &ldquo;غالي&rdquo;، &ldquo;سيء&rdquo;) لتحويلها لفريقك يدوياً.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs hover:shadow-xl hover:border-amber-300 transition duration-300 group">
            <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
              📱
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">محاكي موبايل حي وتفاعلي</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              شاهد بالريال تايم كيف ستظهر الردود ورسائل الخاص على شاشة هاتف العميل، واختبر استبدال الأسماء والمتغيرات التلقائية قبل النشر الفعلي.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works (3 Easy Steps) */}
      <section id="how-it-works" className="py-20 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-black text-slate-900">ابدأ في 3 خطوات بسيطة فقط</h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500">لا تحتاج لأي خبرة برمجية؛ كل شيء جاهز للعمل في أقل من 5 دقائق.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative">
              <span className="text-5xl font-black text-slate-100 absolute top-4 left-6 select-none">01</span>
              <div className="text-2xl mb-4">🔗</div>
              <h3 className="text-base font-bold text-slate-900 mb-2">1. اربط صفحتك بضغطة زر</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                سجل الدخول واختر صفحة فيسبوك أو حساب إنستغرام الخاص بمتجرك بضغطة زر واحدة وآمنة.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative">
              <span className="text-5xl font-black text-slate-100 absolute top-4 left-6 select-none">02</span>
              <div className="text-2xl mb-4">⚡</div>
              <h3 className="text-base font-bold text-slate-900 mb-2">2. اختر قالباً أو صمم مسارك</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                استخدم القوالب الجاهزة (كالرد على الأسعار، كود الخصم، كتالوج المنتجات) أو صمم مسارك المخصص.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative">
              <span className="text-5xl font-black text-slate-100 absolute top-4 left-6 select-none">03</span>
              <div className="text-2xl mb-4">🚀</div>
              <h3 className="text-base font-bold text-slate-900 mb-2">3. انشر وشاهد مبيعاتك تتضاعف</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                فعّل المسار ودع AnyChat يتولى الرد على آلاف العملاء ويوجههم للشراء على مدار الساعة تلقائياً.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Conversion Box */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-r from-[#ff1212] via-rose-600 to-[#0d091e] p-8 sm:p-14 text-center overflow-hidden shadow-2xl">
          <div className="relative z-10 space-y-4">
            <h3 className="text-3xl sm:text-5xl font-black text-white">جاهز لزيادة أرباحك وتوفير وقتك؟</h3>
            <p className="text-white/90 max-w-2xl mx-auto text-xs sm:text-sm leading-relaxed">
              انضم لمئات المتاجر الإلكترونية والشركات التي تضاعف مبيعاتها يومياً مع AnyChat. أنشئ حسابك الآن وابدأ في دقائق.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-2xl bg-white text-[#ff1212] px-8 py-3.5 text-sm font-bold shadow-lg hover:bg-slate-100 hover:scale-105 transition transform cursor-pointer"
              >
                إنشاء حساب مجاني الآن
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto rounded-2xl border border-white/30 text-white px-8 py-3.5 text-sm font-bold hover:bg-white/10 transition cursor-pointer"
              >
                تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="AnyChat Logo"
              width={512}
              height={414}
              className="h-9 w-auto object-contain"
            />
            <span className="text-slate-400">| منصة أتمتة السوشيال ميديا الذكية</span>
          </div>
          <div className="flex items-center gap-6 font-bold text-slate-600">
            <Link href="/login" className="hover:text-[#ff1212] transition">تسجيل الدخول</Link>
            <Link href="/signup" className="hover:text-[#ff1212] transition">إنشاء حساب</Link>
            <Link href="/help" className="hover:text-[#ff1212] transition">مركز المساعدة</Link>
          </div>
        </div>
        <div className="pt-6 text-center sm:text-start text-slate-400">
          جميع الحقوق محفوظة © {new Date().getFullYear()} لـ AnyChat.
        </div>
      </footer>
    </div>
  );
}
