import type { Metadata } from "next";
import "./globals.css";
import Toaster from "@/components/Toaster";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "ShopGenie · 商店精灵",
  description: "AI 电商内容助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full overflow-hidden">
        <AuthGate>
          {children}
        </AuthGate>
        <Toaster />
      </body>
    </html>
  );
}
