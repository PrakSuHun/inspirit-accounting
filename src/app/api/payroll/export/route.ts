import { NextRequest, NextResponse } from "next/server";
import { loadLedger } from "@/lib/data";
import { withholdingByPerson } from "@/lib/tax";

// 지급명세서 / 위택스 특별징수명세서 CSV (엔진 라이브 계산)
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "jiup";
  const year = req.nextUrl.searchParams.get("year") ?? "2026";
  const ledger = loadLedger();
  const people = withholdingByPerson(ledger, year);

  let header: string[];
  let lines: string[][];

  if (type === "witax") {
    // 위택스 특별징수명세서: 지방소득세
    header = ["수령인", "주민번호", "건수", "지급총액", "지방소득세(0.3%)"];
    lines = people.map((p) => [
      p.수령인,
      p.주민번호,
      String(p.건수),
      String(p.지급총액),
      String(p.지방소득세),
    ]);
  } else {
    // 지급명세서(사업소득): 국세
    header = [
      "수령인",
      "주민번호",
      "건수",
      "지급총액",
      "원천세_국세(3%)",
      "지방소득세(0.3%)",
      "실지급액",
    ];
    lines = people.map((p) => [
      p.수령인,
      p.주민번호,
      String(p.건수),
      String(p.지급총액),
      String(p.국세),
      String(p.지방소득세),
      String(p.지급총액 - p.국세 - p.지방소득세),
    ]);
  }

  const csv =
    "﻿" +
    [header, ...lines].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const name = type === "witax" ? `위택스_${year}` : `지급명세서_${year}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        name
      )}.csv"`,
    },
  });
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
