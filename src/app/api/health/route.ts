import { NextResponse } from "next/server";
import { loadLedger } from "@/lib/data";
import { freelancerSet } from "@/lib/tax";

// 임시 진단: payroll vs project_costs 용역비 겹침 확인
export async function GET() {
  try {
    const l = await loadLedger();
    const fl = [...freelancerSet(l)];
    const payroll = l.payroll.map((p) => ({
      수령인: p.수령인,
      귀속연월: p.귀속연월,
      지급액: p.지급액,
      업종: p.업종,
    }));
    const pc = l.project_costs
      .filter((c) => c.구분 === "용역비")
      .map((c) => ({
        파트너: c.파트너,
        월: String(c.지출일).slice(0, 7),
        금액: c.금액,
        프로젝트: c.프로젝트,
        isFreelancer: freelancerSet(l).has(c.파트너),
      }));
    // 사람별 비교
    const payByPerson: Record<string, number> = {};
    for (const p of payroll) payByPerson[p.수령인] = (payByPerson[p.수령인] ?? 0) + 1;
    const pcByPerson: Record<string, number> = {};
    for (const c of pc) pcByPerson[c.파트너] = (pcByPerson[c.파트너] ?? 0) + 1;
    return NextResponse.json({
      ok: true,
      freelancerSet: fl,
      payroll_건수: payroll.length,
      payroll_인별: payByPerson,
      payroll: payroll.sort((a, b) => a.수령인.localeCompare(b.수령인)),
      projectcost용역비_인별: pcByPerson,
      장우인_payroll: payroll.filter((p) => p.수령인 === "장우인"),
      장우인_projectcost: pc.filter((c) => c.파트너 === "장우인"),
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ ok: false, message: String(err?.message ?? err) }, { status: 500 });
  }
}
