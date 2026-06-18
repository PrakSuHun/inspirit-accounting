import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "인스피릿 장부",
  description: "영상·사진 사업 재무 대시보드",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f5f6fa",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        {/* 모바일 우선: 가운데 정렬된 앱 컨테이너 */}
        <div className="mx-auto w-full max-w-md min-h-screen bg-slate-50 pb-24">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
