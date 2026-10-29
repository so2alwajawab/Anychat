"use client";

import React, { useState } from "react";
import type { ActionButtonItem } from "../common/action-button";

interface EditButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  button?: ActionButtonItem;
  onSave: (updatedButton: ActionButtonItem) => void;
  onDelete?: () => void;
}

export function EditButtonModal({
  isOpen,
  onClose,
  button,
  onSave,
  onDelete,
}: EditButtonModalProps) {
  const [label, setLabel] = useState(button?.label || "زر جديد");
  const [type, setType] = useState<string>(button?.type || "url");
  const [url, setUrl] = useState(button?.url || "");

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      id: button?.id || `btn_${Date.now()}`,
      label: label.trim() || "زر",
      type: type as any,
      url: url.trim(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔘</span>
            <h3 className="text-sm font-bold text-foreground">تعديل الزر التفاعلي (Edit Button)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Button Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">عنوان الزر (Button Title)</label>
              <span className="text-[10px] text-slate-400 font-mono">{label.length}/20</span>
            </div>
            <input
              type="text"
              maxLength={20}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثال: اطلب الآن / تحدث إلينا"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-xs outline-none focus:border-brand font-medium"
            />
          </div>

          {/* Action Trigger Selector */}
          <div>
            <label className="font-bold text-slate-700 block mb-2">
              الإجراء عند النقر على الزر (When button is pressed)
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setType("url")}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-start cursor-pointer ${
                  type === "url"
                    ? "border-brand bg-brand/5 text-brand font-bold"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🌐</span>
                  <div>
                    <div className="text-xs">فتح موقع ويب (Open website)</div>
                    <div className="text-[10px] text-slate-400 font-normal">تحويل العميل لصفحة المنتج أو الشراء</div>
                  </div>
                </div>
                {type === "url" && <span className="text-brand font-bold">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setType("whatsapp")}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-start cursor-pointer ${
                  type === "whatsapp"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-bold"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">💬</span>
                  <div>
                    <div className="text-xs">محادثة واتساب مباشرة (WhatsApp)</div>
                    <div className="text-[10px] text-slate-400 font-normal">فتح محادثة واتساب فوراً مع فريقك</div>
                  </div>
                </div>
                {type === "whatsapp" && <span className="text-emerald-700 font-bold">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setType("phone")}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-start cursor-pointer ${
                  type === "phone"
                    ? "border-blue-600 bg-blue-50 text-blue-800 font-bold"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📞</span>
                  <div>
                    <div className="text-xs">اتصال هاتفي (Call number)</div>
                    <div className="text-[10px] text-slate-400 font-normal">فتح تطبيق الاتصال على هاتف العميل</div>
                  </div>
                </div>
                {type === "phone" && <span className="text-blue-700 font-bold">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setType("next_step")}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-start cursor-pointer ${
                  type === "next_step"
                    ? "border-purple-600 bg-purple-50 text-purple-800 font-bold"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🔵</span>
                  <div>
                    <div className="text-xs">إرسال رسالة تالية (Send Message)</div>
                    <div className="text-[10px] text-slate-400 font-normal">توصيل الزر بكرت رسالة جديدة في الكانفاس</div>
                  </div>
                </div>
                {type === "next_step" && <span className="text-purple-700 font-bold">✓</span>}
              </button>
            </div>
          </div>

          {/* Action Destination Input */}
          {type !== "next_step" && (
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                {type === "url"
                  ? "رابط الموقع (Website URL)"
                  : type === "whatsapp"
                  ? "رقم الواتساب أو الرابط (مثال: wa.me/2010...)"
                  : "رقم الهاتف للاتصال (Phone number)"}
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === "url"
                    ? "https://yourshop.com/product"
                    : type === "whatsapp"
                    ? "https://wa.me/201000000000"
                    : "+201000000000"
                }
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-xs outline-none focus:border-brand font-mono"
                dir="ltr"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-slate-50/80 px-5 py-3">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
            >
              حذف الزر
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white hover:bg-brand/90 transition cursor-pointer shadow-xs"
            >
              حفظ الزر
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
