import { NextRequest, NextResponse } from "next/server";
import { updateRow, appendRows } from "@/lib/write";
import { loadLedger } from "@/lib/data";

// 사업자통장 잔고 + 세이프박스 잔액 수동 입력 → tax_settings 에 저장
export async function POST(req: NextRequest) {
  try {
    const { 잔고 } = await req.json();
    const ledger = await loadLedger();
    const has = (k: string) => ledger.tax_settings.some((s) => s.항목 === k);
    const upsert = async (항목: string, 값: string | number, 설명: string) => {
      if (has(항목)) await updateRow("tax_settings", "항목", 항목, { 값, 설명 });
      else await appendRows("tax_settings", [{ 항목, 값, 설명 }]);
    };
    const today = new Date().toISOString().slice(0, 10);
    // 모임통장 총액 하나로 저장 (세이프박스 따로 안 나눔)
    await upsert("사업자통장_잔고", Number(잔고) || 0, "카카오뱅크 모임통장 총액(수동)");
    await upsert("사업자통장_세이프박스", 0, "통장+세이프박스 합산해 잔고에 저장");
    await upsert("사업자통장_갱신일", today, "잔고 마지막 업데이트");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
