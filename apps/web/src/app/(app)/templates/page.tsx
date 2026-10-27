import type { Metadata } from "next";
import { Stub } from "@/components/stub";

export const metadata: Metadata = { title: "القوالب" };

export default function TemplatesPage() {
  return (
    <Stub
      title="القوالب"
      description="قوالب الرسائل والردود المستخدمة داخل مخططات الأتمتة."
    />
  );
}
