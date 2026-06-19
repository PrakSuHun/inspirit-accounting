import { NextResponse } from "next/server";

// 임시 진단용: 구글시트 연결을 테스트해 전체 에러 메시지를 반환. (진단 후 삭제 예정)
export async function GET() {
  try {
    const { sheetsRawRows } = await import("@/lib/sheets");
    const raw = await sheetsRawRows();
    const tabs: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) tabs[k] = v.length;
    return NextResponse.json({ ok: true, tabs });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, name: err?.name, message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
