"use client";

import React from "react";

export interface ArabicVariable {
  key: string;
  label: string;
  desc: string;
}

export const DEFAULT_ARABIC_VARIABLES: ArabicVariable[] = [
  { key: "commenter_name", label: "👤 اسم العميل", desc: "اسم العميل صاحب التعليق" },
  { key: "comment_text", label: "💬 نص التعليق", desc: "التعليق الذي كتبه العميل" },
  { key: "page_name", label: "🏢 اسم الصفحة", desc: "اسم صفحة المتجر أو النشاط" },
  { key: "current_date", label: "📅 تاريخ اليوم", desc: "تاريخ اليوم بالتنسيق المحلي" },
  { key: "post.permalink", label: "🔗 رابط المنشور", desc: "رابط المنشور الأصلي" },
];

interface VariablePillProps {
  variable: ArabicVariable;
  onSelect: (variableKey: string) => void;
  variant?: "primary" | "compact";
}

/**
 * زر متغير نصي قابل للإدراج في حقول الردود العامة أو الرسائل الخاصة.
 */
export function VariablePill({ variable, onSelect, variant = "primary" }: VariablePillProps) {
  if (variant === "compact") {
    return (
      <button
        type="button"
        title={variable.desc}
        aria-label={`إدراج المتغير ${variable.label}`}
        onClick={() => onSelect(variable.key)}
        className="rounded bg-red-50 hover:bg-red-100 text-brand px-1.5 py-0.5 text-[10px] font-bold border border-red-100 transition focus:outline-hidden focus:ring-2 focus:ring-brand/40"
      >
        + {variable.label}
      </button>
    );
  }

  return (
    <button
      type="button"
      title={variable.desc}
      aria-label={`إدراج المتغير ${variable.label}`}
      onClick={() => onSelect(variable.key)}
      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 transition focus:outline-hidden focus:ring-2 focus:ring-brand/40"
    >
      <span>{variable.label}</span>
    </button>
  );
}

interface VariablePillListProps {
  variables?: ArabicVariable[];
  onSelect: (variableKey: string) => void;
  variant?: "primary" | "compact";
  title?: string;
  subtitle?: string;
}

/**
 * قائمة من أزرار المتغيرات الجاهزة للإدراج التفاعلي.
 */
export function VariablePillList({
  variables = DEFAULT_ARABIC_VARIABLES,
  onSelect,
  variant = "primary",
  title = "إدراج متغيرات بالرسالة:",
  subtitle = "انقر للإدراج",
}: VariablePillListProps) {
  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-slate-700 text-xs">{title}</span>
          {subtitle && <span className="text-[10px] text-slate-400">{subtitle}</span>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <VariablePill key={v.key} variable={v} onSelect={onSelect} variant={variant} />
        ))}
      </div>
    </div>
  );
}
