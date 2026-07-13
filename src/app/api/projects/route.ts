import { NextRequest, NextResponse } from "next/server";
import {
  updateRow,
  appendRows,
  deleteRowByMatch,
  renameProject,
} from "@/lib/write";

// 공급가/부가세가 함께 오면 계약합계 자동 갱신
function applyContractTotal(patch: Record<string, unknown>) {
  if (patch.공급가 != null && patch.부가세 != null) {
    patch.계약합계 = (Number(patch.공급가) || 0) + (Number(patch.부가세) || 0);
  }
}

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
      await appendRows("projects", [
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
      const ok = await deleteRowByMatch("projects", { "프로젝트명(내부)": body.name });
      return NextResponse.json({ ok });
    }

    // update: {name, patch}
    const { name, patch } = body;
    if (!name || !patch) {
      return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
    }
    // 이름 변경이면 연결(인건비·앤드원·세금계산서)까지 cascade 후 나머지 필드 반영
    const newName = patch["프로젝트명(내부)"];
    if (newName && String(newName).trim() && String(newName).trim() !== name) {
      const cascade = await renameProject(name, String(newName).trim());
      delete patch["프로젝트명(내부)"];
      // 이름 외 다른 필드가 있으면 새 이름 기준으로 마저 반영
      if (Object.keys(patch).length) {
        applyContractTotal(patch);
        await updateRow(
          "projects",
          "프로젝트명(내부)",
          String(newName).trim(),
          patch
        );
      }
      return NextResponse.json({ ok: cascade.project, cascade });
    }
    // 공급가/부가세 수정 시 계약합계 자동 갱신
    applyContractTotal(patch);
    const ok = await updateRow("projects", "프로젝트명(내부)", name, patch);
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
