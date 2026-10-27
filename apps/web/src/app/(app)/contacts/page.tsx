import type { Metadata } from "next";
import { Stub } from "@/components/stub";

export const metadata: Metadata = { title: "جهات الاتصال" };

export default function ContactsPage() {
  return (
    <Stub
      title="جهات الاتصال"
      description="سجل جهات الاتصال المستفيدة من الردود التلقائية عبر فيسبوك وإنستغرام."
    />
  );
}
