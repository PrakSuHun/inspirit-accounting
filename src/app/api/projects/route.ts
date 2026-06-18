import { NextRequest, NextResponse } from "next/server";
import { updateRow, appendRows, deleteRowByMatch } from "@/lib/write";

// 프로젝트 생성/수정 → projects 탭 write
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "update";

    if (action === "create") {
      const p = body.project ?? {};
      if (!p["프로젝트명(내부)"]) {
        return NextResponse.json(
          { ok: false, error: "프로젝트명을 입력하세요." },
          { status: 400 }
        );
      }
      const 공급가 = Number(p.공급가) || 0;
      const 부가세 = p.부가세 != null ? Number(p.부가세) : Math.round(공급가 * 0.1);
      appendRows("projects", [
        {
          "프로젝트명(내부)": String(p["프로젝트명(내부)"]),
          클라이언트: String(p.클라이언트 ?? ""),
          납품일: String(p.납품일 ?? ""),
          상태: String(p.상태 ?? "작업중"),
          공급가,
          부가세,
          계약합계: 공급가 + 부가세,
          정산상태: String(p.정산상태 ?? "작업중"),
          계산서매핑: String(p.계산서매핑 ?? ""),
        },
      ]);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (!body.name) {
        return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
      }
      const ok = deleteRowByMatch("projects", { "프로젝트명(내부)": body.name });
      return NextResponse.json({ ok });
    }

    // update: {name, patch}
    const { name, patch } = body;
    if (!name || !patch) {
      return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
    }
    // 공급가/부가세 수정 시 계약합계 자동 갱신
    if (patch.공급가 != null || patch.부가세 != null) {
      const 공급가 = Number(patch.공급가 ?? 0);
      const 부가세 = Number(patch.부가세 ?? 0);
      if (patch.공급가 != null && patch.부가세 != null) {
        patch.계약합계 = 공급가 + 부가세;
      }
    }
    const ok = updateRow("projects", "프로젝트명(내부)", name, patch);
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
