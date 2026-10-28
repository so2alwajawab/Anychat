import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const thmanyahSans = localFont({
  src: [
    {
      path: "./fonts/thmanyah-sans/thmanyahsans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/thmanyah-sans/thmanyahsans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/thmanyah-sans/thmanyahsans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/thmanyah-sans/thmanyahsans-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-thmanyah",
  display: "swap",
});

const notoArabic = localFont({
  src: "./fonts/arabic/NotoSansArabic.ttf",
  weight: "100 900",
  variable: "--font-noto-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AnyChat — لوحة التحكم",
    template: "%s — AnyChat",
  },
  description: "منصة خاصة لأتمتة التعليقات والرسائل الخاصة على فيسبوك وإنستغرام",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${thmanyahSans.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
