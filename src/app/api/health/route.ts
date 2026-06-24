import { NextResponse } from "next/server";
import { loadLedger } from "@/lib/data";

// 임시 진단: 장태성 project_costs 실태 + 프로젝트명 매칭 확인
export async function GET() {
  try {
    const l = await loadLedger();
    const projNames = l.projects.map((p) => p["프로젝트명(내부)"]);
    const 장태성행 = l.project_costs
      .filter((c) => c.파트너 === "장태성")
      .map((c) => ({
        프로젝트: c.프로젝트,
        구분: c.구분,
        지출일: c.지출일,
        금액: c.금액,
        내용: c.내용,
        프로젝트존재: projNames.includes(c.프로젝트),
      }));
    // 가장 최근 추가분 (지출일 최신 8건) — 방금 넣은 게 들어왔는지
    const 최근 = [...l.project_costs]
      .filter((c) => c.지출일)
      .sort((a, b) => String(b.지출일).localeCompare(String(a.지출일)))
      .slice(0, 8)
      .map((c) => ({ 프로젝트: c.프로젝트, 구분: c.구분, 파트너: c.파트너, 지출일: c.지출일, 금액: c.금액 }));
    return NextResponse.json({
      ok: true,
      project_costs_총건수: l.project_costs.length,
      프로젝트명들: projNames,
      장태성행,
      최근추가8: 최근,
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ ok: false, message: String(err?.message ?? err) }, { status: 500 });
  }
}
