import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { appendRows } from "@/lib/write";
import { loadLedger } from "@/lib/data";

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.replace(/\s/g, "");
    if (keys.some((kw) => norm.includes(kw))) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

function toNum(v: string): number {
  const n = Number((v ?? "").replace(/[, ₩원]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// 지급명세서 엑셀/CSV 일괄 등록 → project_costs(용역비) + partners 신규 추가
export async function POST(req: NextRequest) {
  try {
    const { data, filename } = await req.json();
    if (!data) {
      return NextResponse.json({ ok: false, error: "파일이 없습니다." }, { status: 400 });
    }
    const buf = Buffer.from(data, "base64");
    // CSV 는 UTF-8 문자열로 파싱(한글 헤더 깨짐 방지), 엑셀은 버퍼로
    const isCsv = String(filename ?? "").toLowerCase().endsWith(".csv");
    const wb = isCsv
      ? XLSX.read(buf.toString("utf8"), { type: "string" })
      : XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
      raw: false,
    });
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "데이터 행이 없습니다." },
        { status: 400 }
      );
    }

    const ledger = loadLedger();
    const known = new Map(ledger.partners.map((p) => [p.이름, p]));
    const payrollRows: Record<string, string | number>[] = [];
    const newPartnerRows: Record<string, string | number>[] = [];
    const seenNew = new Set<string>();

    for (const r of rows) {
      const 수령인 = pick(r, ["수령인", "성명", "이름", "받는"]);
      const 금액 = toNum(pick(r, ["지급액", "금액", "지급총액"]));
      if (!수령인 || 금액 <= 0) continue;
      const 지급일 = normalizeDate(pick(r, ["지급일", "지급", "일자", "날짜"]));
      const 주민번호 = pick(r, ["주민", "생년"]);
      const 프로젝트 = pick(r, ["프로젝트", "사업", "현장"]) || "인건비";

      payrollRows.push({
        프로젝트,
        구분: "용역비",
        지출일: 지급일,
        내용: `인건비(${수령인})`,
        금액,
        파트너: 수령인,
        지급여부: "지급 완료",
        선금여부: "",
      });

      if (!known.has(수령인) && !seenNew.has(수령인)) {
        seenNew.add(수령인);
        newPartnerRows.push({
          이름: 수령인,
          소득구분: "사업소득(3.3%)",
          역할: "프리랜서",
          상태: "활성",
          주민번호,
        });
      }
    }

    if (payrollRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "유효한 행을 찾지 못했습니다. 컬럼명을 확인하세요." },
        { status: 400 }
      );
    }

    if (newPartnerRows.length > 0) appendRows("partners", newPartnerRows);
    appendRows("project_costs", payrollRows);

    return NextResponse.json({
      ok: true,
      added: payrollRows.length,
      newPartners: newPartnerRows.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

function normalizeDate(s: string): string {
  if (!s) return "";
  const m = s.match(/(\d{4})[.\-/년 ]+(\d{1,2})[.\-/월 ]+(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}
