import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS 홈화면 아이콘 (PNG) — 폰트 의존 없이 도형으로 그린 장부 아이콘
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#6366f1,#7c3aed)",
        }}
      >
        <div
          style={{
            width: 92,
            height: 112,
            background: "white",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 13,
            padding: "0 20px",
          }}
        >
          <div style={{ height: 12, background: "#a5b4fc", borderRadius: 6 }} />
          <div style={{ height: 12, background: "#c7d2fe", borderRadius: 6 }} />
          <div
            style={{ height: 12, width: "60%", background: "#c7d2fe", borderRadius: 6 }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
