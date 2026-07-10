import { NextRequest, NextResponse } from "next/server";
import { setFiling } from "@/lib/write";

// 원천세 신고 완료 토글 → wh_filings 탭 (귀속월별)
export async function POST(req: NextRequest) {
  try {
    const { 귀속월, filed } = await req.json();
    if (!귀속월) {
      return NextResponse.json({ ok: false, error: "귀속월 필요" }, { status: 400 });
    }
    const today = new Date().toISOString().slice(0, 10);
    // 같은 귀속월의 기존 행(직렬화·중복 포함)을 정리하고 상태를 다시 기록.
    // 토글 off 시 확실히 해제, on 시 깨끗한 한 행만 남김.
    await setFiling(귀속월, !!filed, today);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
