"use client";

import React, { useState } from "react";

interface NegativeKeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  title?: string;
  description?: string;
  quickPresets?: string[];
}

const DEFAULT_PRESETS = ["نصابين", "غالي", "سيء", "شكوى", "تقليد"];

/**
 * مكون إدخال وإدارة الكلمات السلبية المستثناة (Negative Keywords)
 * لمنع الرد الآلي على الشكاوى أو العبارات غير المرغوبة.
 */
export function NegativeKeywordInput({
  keywords = [],
  onChange,
  title = "استثناء كلمات معينة (الكلمات السلبية):",
  description = "إذا احتوى التعليق على أي من هذه الكلمات فلن يتم تشغيل المسار (مثال: كلمات الشكاوى، الاتهامات).",
  quickPresets = DEFAULT_PRESETS,
}: NegativeKeywordInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleAddKeyword = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) return;
    onChange([...keywords, trimmed]);
    setInputValue("");
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    onChange(keywords.filter((_, i) => i !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword(inputValue);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5" htmlFor="negative-kw-input">
          <span>⛔</span>
          <span>{title}</span>
        </label>
        <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-[10px] font-bold">
          {keywords.length} مستثناة
        </span>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>

      {/* Input row */}
      <div className="flex gap-1.5">
        <input
          id="negative-kw-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب كلمة سلبية واضغط إنتر (مثال: نصابين، سيء)"
          aria-label="إدخال كلمة سلبية جديدة"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
        />
        <button
          type="button"
          aria-label="إضافة الكلمة السلبية"
          onClick={() => handleAddKeyword(inputValue)}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition"
        >
          إضافة
        </button>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500 pt-1">
        <span>اقتراحات شائعة:</span>
        {quickPresets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`إضافة اقتراح كلمة سلبية ${preset}`}
            onClick={() => handleAddKeyword(preset)}
            className="rounded bg-slate-200/80 hover:bg-slate-300 px-1.5 py-0.5 text-slate-700 font-medium transition"
          >
            + {preset}
          </button>
        ))}
      </div>

      {/* Render current excluded keywords */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200/80">
          {keywords.map((kw, i) => (
            <span
              key={`${kw}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-xs font-semibold"
            >
              <span>{kw}</span>
              <button
                type="button"
                aria-label={`حذف الكلمة السلبية ${kw}`}
                onClick={() => handleRemoveKeyword(i)}
                className="text-red-600 hover:text-red-900 font-bold p-0.5 rounded transition"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
