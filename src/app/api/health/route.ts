import { NextResponse } from "next/server";
import { loadLedger } from "@/lib/data";
import { appendRows, deleteRowByMatch } from "@/lib/write";

// 임시 진단: 실제 쓰기 경로 end-to-end 테스트 (추가→읽기확인→삭제)
export async function GET() {
  const steps: Record<string, unknown> = {};
  try {
    const marker = "__WRITE_TEST__";
    const row = {
      프로젝트: marker,
      구분: "용역비",
      지출일: "2026-06-24",
      내용: "진단테스트",
      금액: 1,
      파트너: "장태성",
      지급여부: "지급 완료",
      선금여부: "",
    };
    // 1) append
    const n = await appendRows("project_costs", [row]);
    steps.append건수 = n;
    // 2) read back
    const l = await loadLedger();
    const found = l.project_costs.find((c) => c.프로젝트 === marker);
    steps.읽기성공 = !!found;
    steps.읽은값 = found ?? null;
    // 3) delete (정리)
    const del = await deleteRowByMatch("project_costs", { 프로젝트: marker, 금액: 1 });
    steps.삭제성공 = del;
    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, steps, message: String(err?.message ?? err), stack: err?.stack?.slice(0, 500) },
      { status: 500 }
    );
  }
}
