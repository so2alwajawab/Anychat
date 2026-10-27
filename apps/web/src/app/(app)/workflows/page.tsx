import type { Metadata } from "next";
import { Stub } from "@/components/stub";

export const metadata: Metadata = { title: "الأتمتة" };

export default function WorkflowsPage() {
  return (
    <Stub
      title="الأتمتة"
      description="بناء مخططات الأتمتة لردود التعليقات والرسائل الخاصة بقواعد مطابقة مخصصة."
    />
  );
}
