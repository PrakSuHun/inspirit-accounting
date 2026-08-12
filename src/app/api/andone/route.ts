import { NextRequest, NextResponse } from "next/server";
import { appendRows, deleteRowByMatch, setAndoneExclude } from "@/lib/write";

// 앤드원 정산 장부(andone 탭) 추가/수정/삭제/집계제외
// 구분: "청구"(받아야 할 돈) | "수령"(받은 돈, 경로업체 통해)
type EntryInput = {
  날짜?: string;
  구분?: string;
  내용?: string;
  금액?: number | string;
  경로업체?: string;
  프로젝트?: string;
  집계제외?: boolean | string;
};

function normalize(e: EntryInput): Record<string, string | number> {
  return {
    날짜: String(e.날짜 ?? ""),
    구분: e.구분 === "수령" ? "수령" : "청구",
    내용: String(e.내용 ?? ""),
    금액: Number(e.금액) || 0,
    경로업체: String(e.경로업체 ?? ""),
    프로젝트: String(e.프로젝트 ?? ""),
    집계제외: e.집계제외 === true || e.집계제외 === "Y" ? "Y" : "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "delete") {
      const m = body.match ?? {};
      if (!m.구분 || m.금액 == null) {
        return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
      }
      const ok = await deleteRowByMatch("andone", m);
      return NextResponse.json({ ok });
    }

    if (action === "exclude") {
      // 삭제 없이 집계에서만 빼기/되돌리기
      const m = body.match ?? {};
      if (!m.구분 || m.금액 == null) {
        return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
      }
      const n = await setAndoneExclude(m, body.excluded !== false);
      return NextResponse.json({ ok: n > 0, updated: n });
    }

    if (action === "update") {
      // PK가 없어 원행을 지우고 새 행을 추가하는 방식으로 수정
      const m = body.match ?? {};
      const e = body.entry ?? {};
      if (!m.구분 || !e.구분 || e.금액 == null) {
        return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
      }
      await deleteRowByMatch("andone", m);
      // 날짜는 raw=true 로 텍스트 저장 (구글시트 자동 날짜변환 방지 → 삭제 매칭 안정)
      await appendRows("andone", [normalize(e)], true);
      return NextResponse.json({ ok: true });
    }

    // create
    const e: EntryInput = body.entry ?? {};
    if (!e.구분 || !Number(e.금액)) {
      return NextResponse.json(
        { ok: false, error: "구분과 금액은 필수입니다." },
        { status: 400 }
      );
    }
    await appendRows("andone", [normalize(e)], true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
