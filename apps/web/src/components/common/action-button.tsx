"use client";

import React, { useState } from "react";

export interface ActionButtonItem {
  id?: string;
  label: string;
  type?: "url" | "whatsapp" | "phone";
  url: string;
}

interface ActionButtonsManagerProps {
  buttons: ActionButtonItem[];
  onChange: (buttons: ActionButtonItem[]) => void;
  maxButtons?: number;
  title?: string;
  description?: string;
}

/**
 * مكون إدارة الأزرار التفاعلية المرفقة مع الرسائل (Action Buttons)
 * تتيح للمستخدم إضافة أزرار توجيه للمتجر أو محادثة واتساب أو اتصال هاتفي.
 */
export function ActionButtonsManager({
  buttons = [],
  onChange,
  maxButtons = 3,
  title = "أزرار تفاعلية داخل الرسالة",
  description = "أضف أزراراً تظهر مباشرة أسفل الرسالة للعميل (مثل رابط المتجر أو محادثة واتساب فوري).",
}: ActionButtonsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [btnLabel, setBtnLabel] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  const [btnType, setBtnType] = useState<"url" | "whatsapp" | "phone">("url");

  const handleAddButton = () => {
    if (!btnLabel.trim() || !btnUrl.trim()) return;
    onChange([
      ...buttons,
      {
        label: btnLabel.trim(),
        url: btnUrl.trim(),
        type: btnType,
      },
    ]);
    setBtnLabel("");
    setBtnUrl("");
    setIsAdding(false);
  };

  const handleRemoveButton = (index: number) => {
    onChange(buttons.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
          <span>🔘</span>
          <span>{title}</span>
        </label>
        <span className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-[10px] font-bold">
          {buttons.length} / {maxButtons}
        </span>
      </div>

      <p className="text-[11px] text-slate-600 leading-relaxed">{description}</p>

      {/* Existing buttons list */}
      {buttons.length > 0 && (
        <div className="space-y-1.5">
          {buttons.map((btn, bIdx) => (
            <div
              key={bIdx}
              className="flex items-center justify-between rounded-lg bg-white p-2 border border-sky-200 text-xs shadow-2xs"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span>{btn.type === "whatsapp" ? "💬" : btn.type === "phone" ? "📞" : "🔗"}</span>
                <span className="font-bold text-slate-800 truncate">{btn.label}</span>
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" dir="ltr">
                  {btn.url}
                </span>
              </div>
              <button
                type="button"
                aria-label={`حذف الزر ${btn.label}`}
                onClick={() => handleRemoveButton(bIdx)}
                className="text-red-500 hover:text-red-700 text-xs p-1 hover:bg-red-50 rounded font-bold transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new button form / trigger */}
      {!isAdding ? (
        buttons.length < maxButtons && (
          <button
            type="button"
            aria-label="إضافة زر تفاعلي جديد"
            onClick={() => setIsAdding(true)}
            className="w-full rounded-lg border border-dashed border-sky-300 bg-white/80 py-2 text-xs font-bold text-sky-700 hover:bg-white transition flex items-center justify-center gap-1.5"
          >
            <span>➕</span>
            <span>إضافة زر تفاعلي جديد</span>
          </button>
        )
      ) : (
        <div className="rounded-lg bg-white p-2.5 border border-sky-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">تجهيز الزر التفاعلي:</span>
            <button
              type="button"
              aria-label="إلغاء إضافة الزر"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setBtnType("url")}
              className={`p-1 rounded border text-center font-bold ${
                btnType === "url" ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600"
              }`}
            >
              🔗 رابط خارجي
            </button>
            <button
              type="button"
              onClick={() => {
                setBtnType("whatsapp");
                if (!btnUrl) setBtnUrl("https://wa.me/201000000000");
              }}
              className={`p-1 rounded border text-center font-bold ${
                btnType === "whatsapp" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"
              }`}
            >
              💬 واتساب
            </button>
            <button
              type="button"
              onClick={() => {
                setBtnType("phone");
                if (!btnUrl) setBtnUrl("tel:01000000000");
              }}
              className={`p-1 rounded border text-center font-bold ${
                btnType === "phone" ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-600"
              }`}
            >
              📞 اتصال
            </button>
          </div>

          <input
            type="text"
            value={btnLabel}
            onChange={(e) => setBtnLabel(e.target.value)}
            placeholder="عنوان الزر (مثال: الشراء الآن، واتساب المتجر)"
            aria-label="عنوان الزر"
            className="w-full rounded-md border border-slate-200 p-1.5 text-xs outline-none focus:border-brand"
          />

          <input
            type="text"
            value={btnUrl}
            onChange={(e) => setBtnUrl(e.target.value)}
            placeholder={
              btnType === "whatsapp"
                ? "https://wa.me/201xxxxxxxxx"
                : btnType === "phone"
                ? "tel:010xxxxxxxx"
                : "https://yourstore.com"
            }
            aria-label="رابط الزر أو رقم الاتصال"
            className="w-full rounded-md border border-slate-200 p-1.5 text-xs outline-none focus:border-brand"
            dir="ltr"
          />

          <button
            type="button"
            aria-label="حفظ الزر وإضافته للرسالة"
            disabled={!btnLabel.trim() || !btnUrl.trim()}
            onClick={handleAddButton}
            className="w-full rounded-md bg-brand py-1.5 text-xs font-bold text-white hover:bg-brand/90 disabled:opacity-50 transition"
          >
            تأكيد إضافة الزر
          </button>
        </div>
      )}
    </div>
  );
}
