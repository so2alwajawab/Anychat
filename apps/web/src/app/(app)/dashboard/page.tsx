import type { Metadata } from "next";
import { Stub } from "@/components/stub";

export const metadata: Metadata = { title: "لوحة التحكم" };

export default function DashboardPage() {
  return (
    <Stub
      title="لوحة التحكم"
      description="نظرة عامة على الجلسات النشطة ونتائج التعليقات المعالجة تلقائياً."
    />
  );
}
