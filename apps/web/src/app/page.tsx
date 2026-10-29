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
    <div className="min-h-screen bg-[#0d091e] text-white selection:bg-[#ff1212] selection:text-white relative overflow-hidden font-sans">
      {/* Background Glows & Ambience */}
      <div className="absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-[#ff1212]/20 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-10 -z-10 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-600/15 via-rose-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 -z-10 h-[450px] w-[450px] rounded-full bg-[#ff1212]/15 blur-3xl pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0d091e]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-[#ff1212] to-rose-600 flex items-center justify-center shadow-lg shadow-[#ff1212]/30 group-hover:scale-105 transition transform">
              <span className="text-xl">💬</span>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                {"AnyChat"}
                <span className="h-2 w-2 rounded-full bg-[#ff1212] animate-pulse" />
              </span>
              <span className="text-[10px] block font-bold text-slate-400 tracking-wider">
                منصة أتمتة التعليقات الذكية
              </span>
            </div>
          </Link>

          {/* Navigation links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-white transition">المميزات الرئيسية</a>
            <a href="#how-it-works" className="hover:text-white transition">كيف يعمل؟</a>
            <a href="#integrations" className="hover:text-white transition">الربط والمنصات</a>
            <a href="#stats" className="hover:text-white transition">الأرقام والنتائج</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-gradient-to-r from-[#ff1212] to-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-[#ff1212]/25 hover:opacity-95 transition"
              >
                الدخول للوحة التحكم 🚀
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/10 transition"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-gradient-to-r from-[#ff1212] to-rose-600 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-[#ff1212]/25 hover:opacity-95 transition"
                >
                  ابدأ مجاناً الآن
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#ff1212]/30 bg-[#ff1212]/10 px-4 py-1.5 text-xs font-bold text-rose-300 mb-8 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-[#ff1212] animate-ping" />
          <span>الجيل الجديد من أتمتة فيسبوك وإنستغرام بدعم عربي 100%</span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight sm:leading-none max-w-5xl mx-auto">
          حوّل كل تعليق إلى <span className="bg-gradient-to-r from-[#ff1212] via-rose-400 to-amber-300 bg-clip-text text-transparent">مبيعة فورية</span> في ثوانٍ معدودة
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
          المنصة السحابية الأقوى لأصحاب المتاجر والمشاريع: ردود تلقائية ذكية في التعليقات، إعجاب فوري، ورسائل خاصة تفاعلية بأزرار شراء وواتساب على مدار 24 ساعة دون أي تدخل بشري.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#ff1212] to-rose-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#ff1212]/30 hover:scale-105 transition transform"
          >
            <span>ابدأ تجربتك المجانية الآن</span>
            <span>←</span>
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-md px-8 py-4 text-base font-bold text-slate-200 hover:bg-white/10 hover:text-white transition"
          >
            <span>تسجيل دخول الحساب</span>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>بدون بطاقة ائتمان</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>ربط مباشر وآمن مع Meta Graph API</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>حماية من حظر الحسابات (Anti-Spam Multi-Reply)</span>
          </div>
        </div>

        {/* Product Visual Mockup */}
        <div className="mt-16 relative rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-3 shadow-2xl backdrop-blur-xl max-w-5xl mx-auto">
          <div className="rounded-2xl bg-[#130d2a] p-4 sm:p-6 border border-white/10 overflow-hidden text-start">
            {/* Window bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-400 mr-2 font-mono">{"AnyChat Flow Builder Canvas"}</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                ● المسار نشط ومباشر (Live)
              </span>
            </div>

            {/* Simulated Visual Nodes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Node 1: Trigger */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <span>⚡</span>
                  <span>مشغل البداية (Trigger)</span>
                </div>
                <div className="text-xs text-white font-bold">تعليق العميل بكلمة &ldquo;سعر&rdquo; أو &ldquo;تفاصيل&rdquo;</div>
                <div className="text-[11px] text-slate-400">تشغيل فوري + إعجاب تلقائي بالتعليق 👍</div>
              </div>

              {/* Node 2: Public Reply */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <span>💬</span>
                  <span>الرد العام في التعليقات</span>
                </div>
                <div className="text-xs text-white font-bold">تنويع عشوائي بين 4 صيغ مختلفة</div>
                <div className="text-[11px] text-slate-400">&ldquo;أهلاً بك يا أحمد، تم إرسال كل التفاصيل في الخاص!&rdquo;</div>
              </div>

              {/* Node 3: Private Reply */}
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
                  <span>📩</span>
                  <span>الرسالة الخاصة التفاعلية</span>
                </div>
                <div className="text-xs text-white font-bold">صورة المنتج + أزرار تفاعلية</div>
                <div className="flex gap-1.5 pt-1">
                  <span className="rounded bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 font-bold">🔗 اطلب الآن</span>
                  <span className="rounded bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 font-bold">💬 واتساب</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="border-y border-white/10 bg-white/[0.02] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl sm:text-5xl font-black text-white font-mono">100%</div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">تغطية لكل استفسارات العملاء</div>
          </div>
          <div>
            <div className="text-3xl sm:text-5xl font-black text-[#ff1212] font-mono">&lt; 3 ثوانٍ</div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">سرعة الرد التلقائي وإرسال الخاص</div>
          </div>
          <div>
            <div className="text-3xl sm:text-5xl font-black text-amber-400 font-mono">3x</div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">مضاعفة نسبة إتمام الطلبات (ROAS)</div>
          </div>
          <div>
            <div className="text-3xl sm:text-5xl font-black text-emerald-400 font-mono">24 / 7</div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">عمل مستمر دون انقطاع أو توقف</div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#ff1212] mb-2">مميزات صُممت لزيادة المبيعات</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white">كل ما يحتاجه متجرك للنمو بدون موظفين إضافيين</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:border-[#ff1212]/40 transition group">
            <div className="h-12 w-12 rounded-2xl bg-[#ff1212]/10 border border-[#ff1212]/20 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">
              🎯
            </div>
            <h4 className="text-lg font-bold text-white mb-2">محرر مسارات بصري متكامل</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              ابنِ مسارات الأتمتة بالسحب والإفلات بكل سلاسة. حدد الشروط، استثنِ الكلمات السلبية، ورتب الردود التلقائية بخوارزميات شجرية ذكية.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:border-emerald-500/40 transition group">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">
              🔘
            </div>
            <h4 className="text-lg font-bold text-white mb-2">أزرار تفاعلية (Button Templates)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              أرسل رسائل خاصة رسمية تتضمن أزراراً حقيقية قابلة للنقر: زر تحويل المتجر، زر محادثة واتساب المباشرة، وزر الاتصال الهاتفي.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:border-blue-500/40 transition group">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">
              👍
            </div>
            <h4 className="text-lg font-bold text-white mb-2">الإعجاب التلقائي بالتعليقات</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              زيادة الوصول الطبيعي (Organic Reach) من خلال الإعجاب الفوري بتعليق العميل كخطوة أولى ترفع التفاعل على بوستاتك وإعلاناتك.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:border-purple-500/40 transition group">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">
              🎲
            </div>
            <h4 className="text-lg font-bold text-white mb-2">تنويع الردود ضد الحظر</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              أضف حتى 5 صيغ مختلفة للرد العام، ليقوم النظام باختيار صيغة عشوائية لكل عميل، مما يحمي حسابك من تقييدات خوارزميات ميتا.
            </p>
          </div>

          {/* Card 5 */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:border-amber-500/40 transition group">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">
              📱
            </div>
            <h4 className="text-lg font-bold text-white mb-2">محاكي موبايل حي وتفاعلي</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              عاين شكل البوست، التعليقات، والرسائل الخاصة تماماً كما ستظهر على هاتف العميل بالريال تايم قبل نشر المسار واعتماده.
            </p>
          </div>

          {/* Card 6 */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:border-rose-500/40 transition group">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition">
              🔒
            </div>
            <h4 className="text-lg font-bold text-white mb-2">أعلى معايير الأمان والتشفير</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              تشفير كامل لكافة رموز الوصول (AES-256-GCM) مع نظام حماية الفينسنج (Fencing Tokens) لمنع تكرار الردود نهائياً.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-r from-[#ff1212] via-rose-600 to-purple-700 p-8 sm:p-14 text-center overflow-hidden shadow-2xl">
          <div className="relative z-10 space-y-4">
            <h3 className="text-3xl sm:text-5xl font-black text-white">جاهز لمضاعفة مبيعاتك وأرباحك؟</h3>
            <p className="text-white/80 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              انضم لمئات المتاجر والشركات التي تعتمد على AnyChat يومياً لتحويل المتابعين إلى مشترين في ثوانٍ.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-2xl bg-white text-[#ff1212] px-8 py-3.5 text-sm font-bold shadow-lg hover:bg-slate-100 transition"
              >
                أنشئ حسابك وابدأ مجاناً
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto rounded-2xl border border-white/30 text-white px-8 py-3.5 text-sm font-bold hover:bg-white/10 transition"
              >
                تسجيل الدخول
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{"AnyChat"}</span>
          <span>© {new Date().getFullYear()} — جميع الحقوق محفوظة.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="hover:text-white transition">تسجيل الدخول</Link>
          <Link href="/signup" className="hover:text-white transition">التسجيل</Link>
          <Link href="/help" className="hover:text-white transition">المساعدة والدعم</Link>
        </div>
      </footer>
    </div>
  );
}
