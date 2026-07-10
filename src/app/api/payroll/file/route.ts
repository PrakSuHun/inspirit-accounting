import { NextRequest, NextResponse } from "next/server";
import { updateRow, appendRows } from "@/lib/write";
import { loadFilings } from "@/lib/data";

// 원천세 신고 완료 토글 → wh_filings 탭 (귀속월별)
export async function POST(req: NextRequest) {
  try {
    const { 귀속월, filed } = await req.json();
    if (!귀속월) {
      return NextResponse.json({ ok: false, error: "귀속월 필요" }, { status: 400 });
    }
    const today = new Date().toISOString().slice(0, 10);
    const exists = (await loadFilings())[귀속월] != null;
    const patch = {
      신고여부: filed ? "완료" : "",
      신고일: filed ? today : "",
    };
    // raw=true: 구글시트가 "2026-06" 을 날짜로 자동변환해 저장하는 것을 막음
    // (변환되면 다시 읽을 때 귀속월 키가 어긋나 신고 상태가 반영 안 됨)
    if (exists) {
      await updateRow("wh_filings", "귀속월", 귀속월, patch, true);
    } else {
      await appendRows("wh_filings", [{ 귀속월, ...patch }], true);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
