import { NextRequest, NextResponse } from "next/server";
import { appendRows, updateRow } from "@/lib/write";
import { loadLedger } from "@/lib/data";

// 인건비 지급 추가 → project_costs(용역비) + partners upsert
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action !== "add") {
      return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
    }
    const p = body.payment ?? {};
    if (!p.수령인 || !p.금액) {
      return NextResponse.json(
        { ok: false, error: "수령인과 금액은 필수입니다." },
        { status: 400 }
      );
    }
    const 수령인 = String(p.수령인).trim();
    if (p.주민번호) await upsertFreelancer(수령인, String(p.주민번호));
    // 사용자가 내용(예: 영상 편집)을 적으면 그대로, 없으면 기본 "인건비(이름)"
    const 내용 = String(p.내용 ?? "").trim() || `인건비(${수령인})`;

    await appendRows(
      "project_costs",
      [
        {
          프로젝트: String(p.프로젝트 || "인건비"),
          구분: "용역비",
          지출일: String(p.지급일 ?? ""),
          내용,
          금액: Number(p.금액) || 0,
          파트너: 수령인,
          지급여부: "지급 완료",
          선금여부: p.선금여부 ? "선금" : "",
        },
      ],
      true // 날짜를 텍스트로 저장 (구글시트 serial 변환 방지 → 삭제/수정 매칭 안정)
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

async function upsertFreelancer(이름: string, 주민번호: string) {
  const ledger = await loadLedger();
  const existing = ledger.partners.find((pt) => pt.이름 === 이름);
  if (!existing) {
    await appendRows("partners", [
      { 이름, 소득구분: "사업소득(3.3%)", 역할: "프리랜서", 상태: "활성", 주민번호 },
    ]);
  } else if (!existing.주민번호) {
    await updateRow("partners", "이름", 이름, { 주민번호 });
  }
}
