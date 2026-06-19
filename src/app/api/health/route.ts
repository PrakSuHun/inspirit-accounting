import { NextResponse } from "next/server";
import { loadLedger, businessAccountBalance } from "@/lib/data";
import {
  financialsByYear,
  withholdingPayments,
  freelancerSet,
} from "@/lib/tax";

// 임시 진단: 구글시트 원시 + 파싱 데이터 확인
export async function GET() {
  try {
    const { sheetsRawRows } = await import("@/lib/sheets");
    const raw = await sheetsRawRows();
    const tabs: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) tabs[k] = v.length;

    const ledger = await loadLedger();
    const wh = withholdingPayments(ledger);
    const fin = financialsByYear(ledger);
    const bal = businessAccountBalance(ledger);
    const fl = [...freelancerSet(ledger)];

    return NextResponse.json({
      ok: true,
      tabs,
      // 원시 첫 행(헤더/값 형식 점검)
      sampleRaw: {
        project_costs: raw["project_costs"]?.[0] ?? null,
        common_expenses: raw["common_expenses"]?.[0] ?? null,
        partners: raw["partners"]?.[0] ?? null,
      },
      parsed: {
        projects: ledger.projects.length,
        project_costs: ledger.project_costs.length,
        common_expenses: ledger.common_expenses.length,
        freelancers: fl,
        인건비_records: wh.length,
        인건비_sample: wh.slice(0, 3),
        공통경비_sample: ledger.common_expenses.slice(0, 3),
        용역비_구분값: [...new Set(ledger.project_costs.map((c) => c.구분))],
        financials: fin,
        잔고: bal,
      },
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, name: err?.name, message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
