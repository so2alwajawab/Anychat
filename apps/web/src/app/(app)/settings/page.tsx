import type { Metadata } from "next";
import { Stub } from "@/components/stub";

export const metadata: Metadata = { title: "الإعدادات" };

export default function SettingsPage() {
  return (
    <Stub
      title="الإعدادات"
      description="إعدادات المنصة والحساب، تغيير كلمة المرور، وإدارة رموز الاسترجاع."
    />
  );
}
