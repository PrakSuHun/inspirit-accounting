import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import fs from "node:fs";

const XLSX_PATH = process.env.XLSX_PATH ?? "";

const ALLOWED = new Set([
  "projects",
  "project_costs",
  "tax_invoices",
  "common_expenses",
  "card_input_vat",
  "bank_transactions",
  "assets",
]);

// 시트 한 탭을 CSV(UTF-8 BOM)로 다운로드 → 엑셀/홈택스 업로드용
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") ?? "";
  if (!ALLOWED.has(tab)) {
    return NextResponse.json({ error: "허용되지 않은 탭" }, { status: 400 });
  }
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    return NextResponse.json({ error: "엑셀 파일 없음" }, { status: 500 });
  }
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const ws = wb.Sheets[tab];
  if (!ws) return NextResponse.json({ error: "시트 없음" }, { status: 404 });

  const csv = XLSX.utils.sheet_to_csv(ws);
  const bom = "﻿"; // 엑셀 한글 깨짐 방지
  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tab}.csv"`,
    },
  });
}
