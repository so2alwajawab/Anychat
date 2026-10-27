import type { Metadata } from "next";
import { Stub } from "@/components/stub";

export const metadata: Metadata = { title: "المساعدة" };

export default function HelpPage() {
  return (
    <Stub
      title="المساعدة"
      description="دليل الاستخدام وإجابات شائعة حول الإعداد والخصوصية وأتمتة التعليقات."
    />
  );
}
