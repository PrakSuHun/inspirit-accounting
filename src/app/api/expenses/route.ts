import { NextRequest, NextResponse } from "next/server";
import { appendRows, deleteRowByMatch } from "@/lib/write";

// 공통경비(판관비) 추가/삭제 → common_expenses 탭 write
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "delete") {
      const m = body.match ?? {};
      if (m.금액 == null) {
        return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
      }
      const ok = await deleteRowByMatch("common_expenses", m);
      return NextResponse.json({ ok });
    }

    const e = body.expense ?? {};
    if (e.금액 == null || !e.구분) {
      return NextResponse.json(
        { ok: false, error: "구분과 금액은 필수입니다." },
        { status: 400 }
      );
    }
    await appendRows("common_expenses", [
      {
        지출일: String(e.지출일 ?? ""),
        구분: String(e.구분),
        항목: String(e.항목 ?? ""),
        금액: Number(e.금액) || 0,
      },
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
