import type { MetadataRoute } from "next";

// PWA 매니페스트 — 홈화면 설치 + 전체화면(standalone)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "인스피릿 장부",
    short_name: "인스피릿",
    description: "영상·사진 사업 재무 대시보드",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6fa",
    theme_color: "#6366f1",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
