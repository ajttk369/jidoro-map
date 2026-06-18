import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "지도로 | 지도 기반 장소 검색",
  description: "장소 검색, 주소 검색, 즐겨찾기, 길찾기와 실시간 교통 정보를 제공하는 지도 중심 웹 서비스입니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
