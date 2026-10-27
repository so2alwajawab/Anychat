"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export function TriggerCommentNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { platform?: string; assetName?: string };
  return (
    <div
      className={`min-w-[220px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-brand shadow-lg ring-2 ring-brand/20" : "border-blue-400"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-brand">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-blue-600">مشغل البداية</span>
          <h4 className="text-sm font-bold text-slate-800">وصول تعليق جديد</h4>
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 border border-slate-100">
        <div>المنصة: <span className="font-medium text-slate-800">{d.platform === "facebook" ? "فيسبوك" : d.platform === "instagram" ? "إنستغرام" : "الكل"}</span></div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-brand !border-2 !border-white" />
    </div>
  );
}

export function ConditionTextNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { op?: string; rules?: Array<{ kind: string; value: string }> };
  const rules = d.rules ?? [];
  return (
    <div
      className={`min-w-[240px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-purple-600 shadow-lg ring-2 ring-purple-600/20" : "border-purple-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-purple-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-purple-600">شرط التحقق</span>
          <h4 className="text-sm font-bold text-slate-800">فحص نص التعليق</h4>
        </div>
      </div>
      <div className="mt-2.5 space-y-1">
        {rules.length === 0 ? (
          <p className="text-xs text-slate-400 italic">لا توجد قواعد فحص بعد</p>
        ) : (
          rules.slice(0, 3).map((r, i) => (
            <div key={i} className="rounded bg-purple-50/60 px-2 py-1 text-xs text-purple-900 border border-purple-100 flex items-center justify-between">
              <span>{r.kind === "text_contains" ? "يحتوي على:" : r.kind === "text_exact" ? "مطابق تماماً:" : "يستثني:"}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-500">
        <span className="text-emerald-600">نعم (تحقق)</span>
        <span className="text-red-500">لا (لم يتحقق)</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: "25%" }}
        className="!h-3 !w-3 !bg-emerald-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: "75%" }}
        className="!h-3 !w-3 !bg-red-500 !border-2 !border-white"
      />
    </div>
  );
}

export function ActionPublicReplyNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { message?: string };
  return (
    <div
      className={`min-w-[220px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-emerald-600 shadow-lg ring-2 ring-emerald-600/20" : "border-emerald-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-emerald-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-emerald-600">إجراء أتمتة</span>
          <h4 className="text-sm font-bold text-slate-800">رد عام على التعليق</h4>
        </div>
      </div>
      <div className="mt-2.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 line-clamp-2 border border-slate-100">
        {d.message || <span className="text-slate-400 italic">اضغط لكتابة نص الرد</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-emerald-600 !border-2 !border-white" />
    </div>
  );
}

export function ActionPrivateReplyNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { message?: string };
  return (
    <div
      className={`min-w-[220px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-sky-600 shadow-lg ring-2 ring-sky-600/20" : "border-sky-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-sky-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-sky-600">إجراء أتمتة</span>
          <h4 className="text-sm font-bold text-slate-800">رد في رسالة خاصة</h4>
        </div>
      </div>
      <div className="mt-2.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 line-clamp-2 border border-slate-100">
        {d.message || <span className="text-slate-400 italic">اضغط لكتابة نص الرسالة</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-sky-600 !border-2 !border-white" />
    </div>
  );
}

export function ActionUseTemplateNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { templateName?: string };
  return (
    <div
      className={`min-w-[220px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-indigo-600 shadow-lg ring-2 ring-indigo-600/20" : "border-indigo-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-indigo-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-indigo-600">استخدام قالب</span>
          <h4 className="text-sm font-bold text-slate-800">إدراج قالب جاهز</h4>
        </div>
      </div>
      <div className="mt-2.5 rounded-lg bg-slate-50 p-2 text-xs font-medium text-slate-800 border border-slate-100">
        {d.templateName || "قالب محدد"}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-indigo-600 !border-2 !border-white" />
    </div>
  );
}

export function ActionStopNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { reason?: string };
  return (
    <div
      className={`min-w-[200px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-red-600 shadow-lg ring-2 ring-red-600/20" : "border-red-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-red-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-red-600">نهاية المسار</span>
          <h4 className="text-sm font-bold text-slate-800">إيقاف الأتمتة</h4>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        السبب: <span className="font-medium text-slate-700">{d.reason || "تم الإيقاف"}</span>
      </div>
    </div>
  );
}

export const workflowNodeTypes = {
  "trigger.comment": TriggerCommentNode,
  "condition.text": ConditionTextNode,
  "action.public_reply": ActionPublicReplyNode,
  "action.private_reply": ActionPrivateReplyNode,
  "action.use_template": ActionUseTemplateNode,
  "action.stop": ActionStopNode,
};
