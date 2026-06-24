import { NextResponse } from "next/server";
import { loadLedger } from "@/lib/data";
import { withholdingPayments } from "@/lib/tax";

// 임시 진단: 병합 후 인건비에 장우인 등 payroll 출처가 뜨는지 확인
export async function GET() {
  try {
    const l = await loadLedger();
    const wh = withholdingPayments(l);
    const 인별: Record<string, { 건수: number; 출처: string[] }> = {};
    for (const p of wh) {
      const r = (인별[p.수령인] ??= { 건수: 0, 출처: [] });
      r.건수++;
      if (!r.출처.includes(p.출처)) r.출처.push(p.출처);
    }
    return NextResponse.json({
      ok: true,
      총건수: wh.length,
      인별,
      장우인: wh
        .filter((p) => p.수령인 === "장우인")
        .map((p) => ({ 월: p.귀속연월, 금액: p.지급총액, 출처: p.출처 })),
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ ok: false, message: String(err?.message ?? err) }, { status: 500 });
  }
}
