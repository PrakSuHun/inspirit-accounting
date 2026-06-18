import { NextResponse } from "next/server";

// 지급명세서 일괄등록용 CSV 템플릿 (예시 행 포함)
export async function GET() {
  const header = ["지급일", "수령인", "주민번호", "지급액", "프로젝트"];
  const example = [
    ["2026-06-01", "홍길동", "900101-1234567", "500000", "한남대 홍보영상"],
    ["2026-06-15", "김프리", "950505-2345678", "300000", ""],
  ];
  const csv =
    "﻿" +
    [header, ...example].map((r) => r.join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        "지급명세서_템플릿"
      )}.csv"`,
    },
  });
}
