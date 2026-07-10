import { NextRequest, NextResponse } from "next/server";
import { appendRows, deleteRowByMatch } from "@/lib/write";

// 프로젝트 지출(용역비/경비/대표인출) 추가/삭제 → project_costs 탭 write
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "delete") {
      const m = body.match ?? {};
      if (!m.프로젝트) {
        return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
      }
      const ok = await deleteRowByMatch("project_costs", m);
      return NextResponse.json({ ok });
    }

    if (action === "update") {
      // project_costs 는 PK가 없어 원행을 지우고 새 행을 추가하는 방식으로 수정
      const m = body.match ?? {};
      const c = body.cost ?? {};
      if (!m.프로젝트 || !c.프로젝트 || c.금액 == null) {
        return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
      }
      await deleteRowByMatch("project_costs", m);
      await appendRows("project_costs", [
        {
          프로젝트: String(c.프로젝트),
          구분: String(c.구분 ?? "경비"),
          지출일: String(c.지출일 ?? ""),
          내용: String(c.내용 ?? ""),
          금액: Number(c.금액) || 0,
          파트너: String(c.파트너 ?? ""),
          지급여부: String(c.지급여부 ?? "지급 완료"),
          선금여부: String(c.선금여부 ?? ""),
        },
      ]);
      return NextResponse.json({ ok: true });
    }

    // create
    const c = body.cost ?? {};
    if (!c.프로젝트 || c.금액 == null) {
      return NextResponse.json(
        { ok: false, error: "프로젝트와 금액은 필수입니다." },
        { status: 400 }
      );
    }
    await appendRows("project_costs", [
      {
        프로젝트: String(c.프로젝트),
        구분: String(c.구분 ?? "경비"),
        지출일: String(c.지출일 ?? ""),
        내용: String(c.내용 ?? ""),
        금액: Number(c.금액) || 0,
        파트너: String(c.파트너 ?? ""),
        지급여부: String(c.지급여부 ?? "지급 완료"),
        선금여부: String(c.선금여부 ?? ""),
      },
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
