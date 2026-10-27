import { UI } from "@anychat/shared";

export function Stub({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
          {UI.stub.badge}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-slate-400">
        {UI.stub.default}
      </div>
    </div>
  );
}
