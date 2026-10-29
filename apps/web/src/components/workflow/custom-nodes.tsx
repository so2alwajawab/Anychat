"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

function formatMessagePreview(text?: string) {
  if (!text) return <span className="text-slate-400 italic">اضغط لكتابة نص الرسالة وإدراج المتغيرات...</span>;

  // Replace variable tags like {{commenter_name}} with pretty badge spans
  const parts = text.split(/(\{\{[a-zA-Z0-9_.]+\}\})/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("{{") && part.endsWith("}}")) {
          const varName = part.slice(2, -2).trim();
          const label =
            varName === "commenter_name"
              ? "👤 اسم العميل"
              : varName === "comment_text"
              ? "💬 نص التعليق"
              : varName === "page_name"
              ? "🏢 اسم الصفحة"
              : varName === "current_date"
              ? "📅 التاريخ"
              : varName === "post.permalink"
              ? "🔗 رابط المنشور"
              : part;

          return (
            <span
              key={i}
              className="mx-0.5 inline-block rounded bg-red-100 px-1 py-0.2 text-[10px] font-semibold text-red-700"
            >
              {label}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}

export function TriggerCommentNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as {
    platform?: string;
    assetName?: string;
    includeReplies?: boolean;
    matchType?: "all_comments" | "keywords";
    excludeKeywords?: string[];
    postScope?: { mode?: string; postExternalIds?: string[] };
  };

  const isSpecificPosts = d.postScope?.mode === "posts" && (d.postScope.postExternalIds?.length ?? 0) > 0;
  const isReels = d.postScope?.mode === "reels";
  const isAllComments = d.matchType === "all_comments";

  return (
    <div
      className={`min-w-[270px] max-w-[320px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-brand shadow-lg ring-2 ring-brand/20" : "border-red-400 hover:border-red-500"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-brand">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-red-600">مشغل البداية (Trigger)</span>
          <h4 className="text-sm font-bold text-slate-800">وصول تعليق جديد</h4>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">المنصة:</span>
          <span className="font-semibold text-slate-800">
            {d.platform === "facebook" ? "📘 فيسبوك فقط" : d.platform === "instagram" ? "📸 إنستغرام فقط" : "🌐 فيسبوك وإنستغرام"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">المنشورات:</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            isSpecificPosts
              ? "bg-amber-100 text-amber-800"
              : isReels
              ? "bg-purple-100 text-purple-800"
              : "bg-emerald-100 text-emerald-800"
          }`}>
            {isSpecificPosts
              ? `📌 ${d.postScope?.postExternalIds?.length} منشور محدد`
              : isReels
              ? "🎬 مقاطع الريلز فقط"
              : "🌐 كل المنشورات"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">نمط المطابقة:</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            isAllComments ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
          }`}>
            {isAllComments ? "✨ أي تعليق" : "🎯 كلمات مفتاحية"}
          </span>
        </div>

        {(d.excludeKeywords?.length ?? 0) > 0 && (
          <div className="flex items-center justify-between text-[10px] text-rose-600 pt-1 border-t border-slate-200/60">
            <span>كلمات مستبعدة:</span>
            <span className="font-bold">{d.excludeKeywords?.length} كلمة</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
          <span>تصفية الردود:</span>
          <span>{d.includeReplies ? "يشمل الردود الفرعية" : "التعليقات الرئيسية فقط"}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-3.5 !w-3.5 !bg-brand !border-2 !border-white" />
    </div>
  );
}

export function ConditionTextNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { op?: string; rules?: Array<{ kind: string; value: string }> };
  const rules = d.rules ?? [];

  return (
    <div
      className={`min-w-[260px] max-w-[320px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-purple-600 shadow-lg ring-2 ring-purple-600/20" : "border-purple-400 hover:border-purple-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3.5 !w-3.5 !bg-purple-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </div>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-purple-600">شرط الفحص (Condition)</span>
          <h4 className="text-sm font-bold text-slate-800">فحص الكلمات المفتاحية</h4>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
          <span>الكلمات المستهدفة:</span>
          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800 font-bold">
            {d.op === "AND" ? "كل الكلمات (AND)" : "أي كلمة (OR)"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {rules.length === 0 ? (
            <p className="text-xs text-slate-400 italic">لا توجد كلمات مفتاحية بعد</p>
          ) : (
            rules.map((r, i) => (
              <span
                key={i}
                className="rounded-lg bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-900"
              >
                {r.value}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px] font-bold">
        <span className="text-emerald-600 flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
          نعم (تحقق)
        </span>
        <span className="text-rose-500 flex items-center gap-1">
          لا (لم يتحقق)
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500"></span>
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: "25%" }}
        className="!h-3.5 !w-3.5 !bg-emerald-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: "75%" }}
        className="!h-3.5 !w-3.5 !bg-rose-500 !border-2 !border-white"
      />
    </div>
  );
}

export function ActionPublicReplyNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as {
    message?: string;
    messages?: string[];
    imageUrl?: string;
    autoLike?: boolean;
  };

  const messageCount = (d.messages?.length ?? 0) > 0 ? d.messages!.length : d.message ? 1 : 0;
  const primaryMessage = (d.messages && d.messages.length > 0 ? d.messages[0] : d.message) || "";

  return (
    <div
      className={`min-w-[270px] max-w-[320px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-emerald-600 shadow-lg ring-2 ring-emerald-600/20" : "border-emerald-400 hover:border-emerald-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3.5 !w-3.5 !bg-emerald-600 !border-2 !border-white" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-600">رد عام على التعليق</span>
            <h4 className="text-sm font-bold text-slate-800">رد عام بالتعليقات</h4>
          </div>
        </div>

        {d.autoLike && (
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold" title="إعجاب تلقائي بالتعليق">
            👍 لايك
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        {messageCount > 1 ? (
          <span className="rounded-md bg-purple-100 text-purple-800 px-2 py-0.5 font-bold flex items-center gap-1">
            <span>🎲 تنويع عشوائي</span>
            <span>({messageCount} صيغ)</span>
          </span>
        ) : (
          <span className="text-slate-400">صيغة رد واحدة</span>
        )}
      </div>

      {d.imageUrl && (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.imageUrl} alt="مرفق الرد" className="h-20 w-full object-cover" />
          <div className="bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 font-medium text-center">
            🖼️ مرفق صورة بالرد
          </div>
        </div>
      )}

      <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-800 border border-slate-100 line-clamp-3 leading-relaxed">
        {formatMessagePreview(primaryMessage)}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-3.5 !w-3.5 !bg-emerald-600 !border-2 !border-white" />
    </div>
  );
}

export function ActionPrivateReplyNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as {
    message?: string;
    imageUrl?: string;
    buttons?: Array<{ label: string; url: string; type?: string }>;
  };

  const hasButtons = Array.isArray(d.buttons) && d.buttons.length > 0;

  return (
    <div
      className={`min-w-[270px] max-w-[320px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-sky-600 shadow-lg ring-2 ring-sky-600/20" : "border-sky-400 hover:border-sky-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3.5 !w-3.5 !bg-sky-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-sky-600">رسالة خاصة (Direct / DM)</span>
          <h4 className="text-sm font-bold text-slate-800">إرسال في الخاص</h4>
        </div>
      </div>

      {d.imageUrl && (
        <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.imageUrl} alt="مرفق الرسالة" className="h-20 w-full object-cover" />
          <div className="bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 font-medium text-center">
            🖼️ مرفق صورة بالرسالة
          </div>
        </div>
      )}

      <div className="mt-2.5 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-800 border border-slate-100 line-clamp-3 leading-relaxed">
        {formatMessagePreview(d.message)}
      </div>

      {hasButtons && (
        <div className="mt-2 space-y-1">
          {d.buttons!.map((btn, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1 rounded-lg bg-sky-50 border border-sky-200 py-1 px-2 text-[11px] font-bold text-sky-800 truncate"
            >
              <span>{btn.type === "whatsapp" ? "💬" : btn.type === "phone" ? "📞" : "🔗"}</span>
              <span className="truncate">{btn.label}</span>
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!h-3.5 !w-3.5 !bg-sky-600 !border-2 !border-white" />
    </div>
  );
}

export function ActionUseTemplateNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { templateName?: string };

  return (
    <div
      className={`min-w-[220px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-indigo-600 shadow-lg ring-2 ring-indigo-600/20" : "border-indigo-400 hover:border-indigo-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3.5 !w-3.5 !bg-indigo-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-600">قالب جاهز (Template)</span>
          <h4 className="text-sm font-bold text-slate-800">استخدام قالب محفوظ</h4>
        </div>
      </div>
      <div className="mt-2.5 rounded-xl bg-indigo-50/70 p-2.5 text-xs font-semibold text-indigo-900 border border-indigo-100 flex items-center justify-between">
        <span>القالب:</span>
        <span className="font-bold">{d.templateName || "قالب محدد"}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3.5 !w-3.5 !bg-indigo-600 !border-2 !border-white" />
    </div>
  );
}

export function ActionStopNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as { reason?: string };

  return (
    <div
      className={`min-w-[200px] rounded-2xl border-2 bg-white p-4 shadow-md transition ${
        selected ? "border-rose-600 shadow-lg ring-2 ring-rose-600/20" : "border-rose-400 hover:border-rose-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-3.5 !w-3.5 !bg-rose-600 !border-2 !border-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </div>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-rose-600">إيقاف (Stop)</span>
          <h4 className="text-sm font-bold text-slate-800">إنهاء المسار</h4>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        السبب: <span className="font-semibold text-slate-700">{d.reason || "تم الإيقاف"}</span>
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
