"use client";

import { useState } from "react";

interface ActionButton {
  id?: string;
  label: string;
  type?: "url" | "whatsapp" | "phone";
  url: string;
}

interface PhonePreviewProps {
  platform?: "facebook" | "instagram" | "all";
  pageName?: string;
  commenterName?: string;
  commentText?: string;
  publicReplyText?: string;
  publicReplyImage?: string;
  autoLike?: boolean;
  privateReplyText?: string;
  privateReplyImage?: string;
  buttons?: ActionButton[];
  postPreviewText?: string;
  postImage?: string;
  onCommentChange?: (newText: string) => void;
}

export function PhonePreview({
  platform = "instagram",
  pageName = "متجر الأناقة",
  commenterName = "أحمد محمود",
  commentText = "بكام الطقم ده وهل متوفر شحن للقاهرة؟",
  publicReplyText = "أهلاً بك {{commenter_name}}، بعتنالك كل التفاصيل والأسعار في رسالة خاصة 📩",
  publicReplyImage,
  autoLike = true,
  privateReplyText = "أهلاً بك يا {{commenter_name}} في {{page_name}}!\n\nيسعدنا اهتمامك. السعر الحالي يبدأ من 250 جنيهاً مع شحن سريع 🚚.",
  privateReplyImage,
  buttons = [],
  postPreviewText = "أحدث تشكيلة ملابس صيف 2026 متوفرة الآن بجميع الفروع والموقع! اطلب الآن.",
  postImage,
  onCommentChange,
}: PhonePreviewProps) {
  const [activeTab, setActiveTab] = useState<"post" | "dm">("dm");
  const [testComment, setTestComment] = useState(commentText);
  const [liked, setLiked] = useState(autoLike);

  const isInstagram = platform === "instagram" || platform === "all";

  // Replace variable tags
  const renderSimulatedText = (text?: string) => {
    if (!text) return "";
    return text
      .replace(/\{\{commenter_name\}\}/g, commenterName)
      .replace(/\{\{comment_text\}\}/g, testComment)
      .replace(/\{\{page_name\}\}/g, pageName)
      .replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString("ar-EG"))
      .replace(/\{\{post\.permalink\}\}/g, "https://instagram.com/p/C99214");
  };

  return (
    <div className="flex flex-col items-center">
      {/* Device Frame */}
      <div className="w-[300px] sm:w-[320px] rounded-[40px] border-[10px] border-slate-900 bg-white shadow-2xl overflow-hidden ring-4 ring-slate-800/20 select-none flex flex-col h-[580px]">
        {/* Dynamic Island / Notch */}
        <div className="bg-slate-900 pt-2 pb-1.5 px-6 flex items-center justify-between text-white text-[11px] font-semibold">
          <span>09:41</span>
          <div className="h-4 w-20 rounded-full bg-black/80 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span>5G</span>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Top App Header & Switcher */}
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{isInstagram ? "📸" : "📘"}</span>
            <span className="font-bold text-xs text-slate-800 truncate max-w-[130px]">{pageName}</span>
            <span className="text-sky-500 text-xs">✔</span>
          </div>

          {/* Tab Switcher */}
          <div className="flex rounded-lg bg-slate-200/80 p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("post")}
              className={`rounded-md px-2 py-0.5 transition ${
                activeTab === "post" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              المنشور
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dm")}
              className={`rounded-md px-2 py-0.5 transition ${
                activeTab === "dm" ? "bg-brand text-white shadow-2xs" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              الخاص (DM)
            </button>
          </div>
        </div>

        {/* Screen Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-3 flex flex-col justify-between text-xs">
          {activeTab === "post" ? (
            /* --- POST & COMMENTS VIEW --- */
            <div className="space-y-3">
              {/* Post Card */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                {postImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={postImage} alt="منشور" className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-24 bg-gradient-to-tr from-brand/20 via-pink-100 to-sky-100 flex items-center justify-center text-slate-400 font-semibold text-[11px]">
                    🖼️ معاينة المنشور المختار
                  </div>
                )}
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-bold text-[11px] text-slate-800">{pageName}</span>
                    <span className="text-sky-500 text-[10px]">✔</span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {postPreviewText}
                  </p>
                </div>
              </div>

              {/* Comments Section */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  التعليقات المباشرة (Live)
                </span>

                {/* Commenter's Comment */}
                <div className="flex items-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-slate-300 flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
                    {commenterName[0]}
                  </div>
                  <div className="flex-1 rounded-2xl bg-white p-2.5 border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-900">{commenterName}</span>
                      <span className="text-[9px] text-slate-400">منذ دقيقة</span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed">{testComment}</p>
                  </div>
                </div>

                {/* Page Auto-Reply */}
                <div className="me-6 flex items-start gap-2 ps-3 border-s-2 border-brand/30">
                  <div className="h-6 w-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    {pageName[0]}
                  </div>
                  <div className="flex-1 rounded-2xl bg-brand/5 border border-brand/20 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-[11px] text-brand">{pageName}</span>
                        <span className="text-brand text-[10px]">✔</span>
                        <span className="rounded bg-brand/10 text-brand px-1 py-0.2 text-[9px] font-semibold">رد تلقائي</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLiked(!liked)}
                        className={`text-xs transition ${liked ? "text-red-500 scale-110" : "text-slate-400"}`}
                        title="إعجاب بالتعليق"
                      >
                        {liked ? "❤️" : "🤍"}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-800 mt-1 leading-relaxed">
                      {renderSimulatedText(publicReplyText)}
                    </p>

                    {publicReplyImage && (
                      <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={publicReplyImage} alt="مرفق الرد" className="h-20 w-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* --- PRIVATE MESSAGE (DM / MESSENGER) VIEW --- */
            <div className="space-y-3 flex-1 flex flex-col justify-end">
              {/* Chat Info Header */}
              <div className="text-center py-2 border-b border-slate-100">
                <div className="mx-auto mb-1 h-12 w-12 rounded-full bg-gradient-to-tr from-brand to-rose-400 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {pageName[0]}
                </div>
                <div className="flex items-center justify-center gap-1">
                  <h4 className="font-bold text-xs text-slate-800">{pageName}</h4>
                  <span className="text-sky-500 text-xs">✔</span>
                </div>
                <p className="text-[10px] text-slate-400">حساب تجاري موثق • نشط الآن</p>
              </div>

              {/* Page Response Bubble */}
              <div className="flex items-end gap-1.5">
                <div className="h-6 w-6 rounded-full bg-brand text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {pageName[0]}
                </div>

                <div className="max-w-[85%] space-y-1.5">
                  {/* Message Bubble */}
                  <div className="rounded-2xl rounded-br-xs bg-white border border-slate-200 p-3 shadow-xs text-slate-800 leading-relaxed text-[11px] whitespace-pre-line">
                    {renderSimulatedText(privateReplyText)}
                  </div>

                  {/* Attached Image */}
                  {privateReplyImage && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={privateReplyImage} alt="مرفق خاص" className="h-28 w-full object-cover" />
                    </div>
                  )}

                  {/* Interactive Action Buttons */}
                  {buttons && buttons.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {buttons.map((btn, idx) => (
                        <a
                          key={idx}
                          href={btn.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-brand text-white font-bold py-2 px-3 text-[11px] shadow-xs transition active:scale-98"
                        >
                          <span>{btn.type === "whatsapp" ? "💬" : btn.type === "phone" ? "📞" : "🔗"}</span>
                          <span>{btn.label}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Simulated Comment Input */}
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <input
                type="text"
                value={testComment}
                onChange={(e) => {
                  setTestComment(e.target.value);
                  onCommentChange?.(e.target.value);
                }}
                placeholder="اكتب تعليقاً لتجربة المحاكاة..."
                className="flex-1 bg-transparent px-2 text-[11px] outline-none text-slate-700"
              />
              <span className="text-[10px] font-bold text-brand px-2 py-0.5 rounded-lg bg-red-50">
                تجربة حية
              </span>
            </div>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="bg-white py-1.5 flex justify-center">
          <div className="h-1 w-28 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
  );
}
