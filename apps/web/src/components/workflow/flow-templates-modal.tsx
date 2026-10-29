"use client";

import React, { useEffect, useRef } from "react";
import { MANYCHAT_FLOW_TEMPLATES, type FlowTemplate } from "./flow-templates";

export interface FlowTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: FlowTemplate) => void;
}

/**
 * نافذة اختيار قوالب ManyChat الجاهزة (FlowTemplatesModal)
 * مدعومة بالكامل لمعايير الوصول (WCAG Accessibility) والتركيز التلقائي وإغلاق بـ ESC.
 */
export function FlowTemplatesModal({ isOpen, onClose, onApplyTemplate }: FlowTemplatesModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the close button or first interactive element upon open
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-modal-title"
      aria-describedby="templates-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h2 id="templates-modal-title" className="text-xl font-bold text-foreground">
                قوالب أتمتة ManyChat الجاهزة
              </h2>
              <span className="rounded-full bg-brand/10 text-brand px-2.5 py-0.5 text-xs font-bold">
                جاهز للاستخدام بنقرة واحدة
              </span>
            </div>
            <p id="templates-modal-desc" className="text-xs text-slate-500 mt-1">
              اختر من بين أشهر نماذج أتمتة التعليقات والرسائل لفيسبوك وإنستغرام لتجهيز مسارك بالكامل مع الربط التلقائي.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="إغلاق نافذة القوالب"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm rounded-lg hover:bg-slate-100 transition focus:outline-hidden focus:ring-2 focus:ring-brand/40"
          >
            ✕
          </button>
        </div>

        {/* Templates Grid */}
        <div className="mt-4 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pe-1">
          {MANYCHAT_FLOW_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-2xl border border-border bg-white p-5 shadow-xs hover:border-brand/50 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shadow-2xs">
                      {tpl.icon}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">{tpl.category}</span>
                      <h3 className="font-bold text-sm text-slate-900">{tpl.title}</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-red-50 text-brand border border-red-100 px-2 py-0.5 text-[10px] font-bold shrink-0">
                    {tpl.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mt-2">{tpl.description}</p>

                <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5">🔹 {tpl.nodes.length} عقدة متصلة</span>
                  <span className="rounded-md bg-emerald-50 text-emerald-800 px-2 py-0.5">💬 رد عام</span>
                  <span className="rounded-md bg-sky-50 text-sky-800 px-2 py-0.5">📩 رسالة خاصة</span>
                  <span className="rounded-md bg-purple-50 text-purple-800 px-2 py-0.5">🎯 شروط ذكية</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  aria-label={`استخدام قالب ${tpl.title} الآن`}
                  onClick={() => onApplyTemplate(tpl)}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand/90 transition shadow-xs flex items-center gap-1.5 focus:outline-hidden focus:ring-2 focus:ring-brand/40"
                >
                  <span>⚡</span>
                  <span>استخدام هذا القالب الآن</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-slate-400">
            يمكنك تخصيص وتعديل أي نصوص أو شروط بحرية بعد استيراد القالب على اللوحة.
          </span>
          <button
            type="button"
            aria-label="إغلاق نافذة القوالب"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
