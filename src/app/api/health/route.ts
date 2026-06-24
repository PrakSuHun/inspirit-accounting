import { NextResponse } from "next/server";
import { loadLedger } from "@/lib/data";
import { withholdingPayments, freelancerSet } from "@/lib/tax";

// 임시 진단: batchGet 읽기 + 인건비 파싱 확인
export async function GET() {
  try {
    const ledger = await loadLedger();
    const wh = withholdingPayments(ledger);
    const byPerson: Record<string, number> = {};
    for (const p of wh) byPerson[p.수령인] = (byPerson[p.수령인] ?? 0) + 1;
    return NextResponse.json({
      ok: true,
      project_costs: ledger.project_costs.length,
      common_expenses: ledger.common_expenses.length,
      freelancers: [...freelancerSet(ledger)],
      인건비_records: wh.length,
      인건비_인별건수: byPerson,
      최근_용역비: wh.slice(0, 5).map((p) => ({
        수령인: p.수령인,
        지급일: p.지급일,
        금액: p.지급총액,
        프로젝트: p.프로젝트,
      })),
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
