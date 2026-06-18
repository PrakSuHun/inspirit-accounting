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
    const exists = loadFilings()[귀속월] != null;
    const patch = {
      신고여부: filed ? "완료" : "",
      신고일: filed ? today : "",
    };
    if (exists) {
      updateRow("wh_filings", "귀속월", 귀속월, patch);
    } else {
      appendRows("wh_filings", [{ 귀속월, ...patch }]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
