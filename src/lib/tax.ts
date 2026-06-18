import "server-only";
import type { Ledger } from "./types";

// ════════════════════════════════════════════════════════════════
//  세금 계산 엔진 — 전부 원자료(project_costs, tax_invoices 등)에서
//  라이브 계산. 정적 스냅샷(01_재무제표·02_세금현황)에 의존하지 않음.
// ════════════════════════════════════════════════════════════════

// ── 과세기간 ─────────────────────────────────────────────────────
export function vatPeriod(dateStr: string): string {
  const s = String(dateStr);
  const y = s.slice(0, 4);
  const m = Number(s.slice(5, 7)) || 1;
  return `${y}-${m <= 6 ? "1기" : "2기"}`;
}

export type VatPeriodRow = {
  period: string;
  매출세액: number;
  매입세액_계산서: number;
  납부세액: number; // 세금계산서 기준 (카드매입 별도)
};

// 부가세 — 과세기간별 (세금계산서 기준). 카드 매입세액은 연 단위라 별도 집계.
export function vatByPeriod(ledger: Ledger): {
  periods: VatPeriodRow[];
  카드매입_연간: Record<string, number>;
} {
  const out = new Map<string, VatPeriodRow>();
  const get = (p: string) => {
    if (!out.has(p))
      out.set(p, { period: p, 매출세액: 0, 매입세액_계산서: 0, 납부세액: 0 });
    return out.get(p)!;
  };
  for (const inv of ledger.tax_invoices) {
    if (!inv.작성일) continue;
    const p = vatPeriod(inv.작성일);
    const row = get(p);
    if (inv.구분 === "매출") row.매출세액 += inv.세액;
    else if (inv.구분 === "매입") row.매입세액_계산서 += inv.세액;
  }
  for (const row of out.values())
    row.납부세액 = row.매출세액 - row.매입세액_계산서;

  const 카드매입_연간: Record<string, number> = {};
  for (const c of ledger.card_input_vat) {
    const y = String(c.연도).slice(0, 4);
    카드매입_연간[y] = (카드매입_연간[y] ?? 0) + c.매입세액;
  }

  return {
    periods: [...out.values()].sort((a, b) => a.period.localeCompare(b.period)),
    카드매입_연간,
  };
}

// ── 원천세 (프리랜서 사업소득 3.3%) ──────────────────────────────
const 국세율 = 0.03;
const 지방세율 = 0.003;

// partners 중 소득구분에 '3.3' 들어가면 원천징수 대상 프리랜서
export function freelancerSet(ledger: Ledger): Set<string> {
  return new Set(
    ledger.partners
      .filter((p) => p.소득구분.includes("3.3") || p.소득구분.includes("사업소득"))
      .map((p) => p.이름)
  );
}

export type WithholdingPayment = {
  지급일: string;
  귀속연월: string; // YYYY-MM
  수령인: string;
  지급총액: number;
  국세: number;
  지방소득세: number;
  원천세합: number;
  실지급액: number;
  프로젝트: string;
  내용: string; // 삭제 매칭용
};

// 인건비 탭 = 프로젝트에 기록한 용역비(프리랜서 지급분) 기준 = 실제 지급 기록. (최신순)
// (세금 탭 공제는 별도로 공식 지급명세서 기준 — deductibleByYear 참고)
export function withholdingPayments(ledger: Ledger): WithholdingPayment[] {
  const fl = freelancerSet(ledger);
  return ledger.project_costs
    .filter((c) => c.구분 === "용역비" && fl.has(c.파트너) && c.지출일)
    .map((c) => {
      const 국세 = Math.floor((c.금액 * 국세율) / 10) * 10;
      const 지방 = Math.floor((c.금액 * 지방세율) / 10) * 10;
      return {
        지급일: c.지출일,
        귀속연월: String(c.지출일).slice(0, 7),
        수령인: c.파트너,
        지급총액: c.금액,
        국세,
        지방소득세: 지방,
        원천세합: 국세 + 지방,
        실지급액: c.금액 - 국세 - 지방,
        프로젝트: c.프로젝트,
        내용: c.내용,
      };
    })
    .sort((a, b) => String(b.지급일).localeCompare(String(a.지급일)));
}

export type WithholdingMonthly = {
  귀속연월: string;
  인원: number;
  지급총액: number;
  국세: number;
  지방소득세: number;
  징수세액합: number;
};

// 월별 원천징수이행상황신고서용 요약
export function withholdingByMonth(ledger: Ledger): WithholdingMonthly[] {
  const pays = withholdingPayments(ledger);
  const m = new Map<string, WithholdingMonthly & { _people: Set<string> }>();
  for (const p of pays) {
    if (!p.귀속연월) continue;
    let row = m.get(p.귀속연월);
    if (!row) {
      row = {
        귀속연월: p.귀속연월,
        인원: 0,
        지급총액: 0,
        국세: 0,
        지방소득세: 0,
        징수세액합: 0,
        _people: new Set(),
      };
      m.set(p.귀속연월, row);
    }
    row._people.add(p.수령인);
    row.지급총액 += p.지급총액;
    row.국세 += p.국세;
    row.지방소득세 += p.지방소득세;
  }
  return [...m.values()]
    .map((r) => ({
      귀속연월: r.귀속연월,
      인원: r._people.size,
      지급총액: r.지급총액,
      국세: r.국세,
      지방소득세: r.지방소득세,
      징수세액합: r.국세 + r.지방소득세,
    }))
    .sort((a, b) => a.귀속연월.localeCompare(b.귀속연월));
}

export type WithholdingByPerson = {
  수령인: string;
  주민번호: string;
  건수: number;
  지급총액: number;
  국세: number;
  지방소득세: number;
};

// 연도별 인별 지급명세서용 집계
export function withholdingByPerson(
  ledger: Ledger,
  year: string
): WithholdingByPerson[] {
  const pays = withholdingPayments(ledger).filter((p) =>
    p.귀속연월.startsWith(year)
  );
  const jumin = new Map(
    ledger.partners.map((p) => [p.이름, p.주민번호 ?? ""])
  );
  const m = new Map<string, WithholdingByPerson>();
  for (const p of pays) {
    let row = m.get(p.수령인);
    if (!row) {
      row = {
        수령인: p.수령인,
        주민번호: jumin.get(p.수령인) ?? "",
        건수: 0,
        지급총액: 0,
        국세: 0,
        지방소득세: 0,
      };
      m.set(p.수령인, row);
    }
    row.건수 += 1;
    row.지급총액 += p.지급총액;
    row.국세 += p.국세;
    row.지방소득세 += p.지방소득세;
  }
  return [...m.values()].sort((a, b) => b.지급총액 - a.지급총액);
}

// ── 원천세 신고 일정 (매월 10일 = 전월 지급분) ───────────────────
// 귀속월(지급월) → 신고·납부 기한 = 다음 달 10일
export function filingDeadline(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-10`;
}

export type FilingRow = WithholdingMonthly & {
  신고기한: string; // 다음달 10일
  신고월: string; // 신고하는 달 (YYYY-MM)
  filed: boolean;
  신고일: string;
  status: "완료" | "지연" | "이번신고" | "예정";
};

// 신고 일정표: 귀속월별로 기한·상태·완료여부 부여. today 기준으로 '이번신고' 판정.
export function withholdingSchedule(
  ledger: Ledger,
  filedMap: Record<string, { 신고여부: string; 신고일: string }>,
  today: string
): FilingRow[] {
  const months = withholdingByMonth(ledger);
  const rows: FilingRow[] = months.map((m) => {
    const 기한 = filingDeadline(m.귀속연월);
    const f = filedMap[m.귀속연월];
    const filed = !!f && (f.신고여부 === "완료" || f.신고여부 === "Y");
    let status: FilingRow["status"];
    if (filed) status = "완료";
    else if (기한 < today) status = "지연";
    else status = "예정";
    return {
      ...m,
      신고기한: 기한,
      신고월: 기한.slice(0, 7),
      filed,
      신고일: f?.신고일 ?? "",
      status,
    };
  });
  // 미신고(예정) 중 기한이 가장 빠른 것 = '이번신고'
  const nextIdx = rows
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.status === "예정")
    .sort((a, b) => a.r.신고기한.localeCompare(b.r.신고기한))[0]?.i;
  if (nextIdx != null) rows[nextIdx].status = "이번신고";
  return rows.sort((a, b) => b.귀속연월.localeCompare(a.귀속연월));
}

// ── 종합소득세 (개인사업자, 누진세율 추정) ───────────────────────
const 누진표 = [
  { limit: 14_000_000, rate: 0.06, deduct: 0 },
  { limit: 50_000_000, rate: 0.15, deduct: 1_260_000 },
  { limit: 88_000_000, rate: 0.24, deduct: 5_760_000 },
  { limit: 150_000_000, rate: 0.35, deduct: 15_440_000 },
  { limit: 300_000_000, rate: 0.38, deduct: 19_940_000 },
  { limit: 500_000_000, rate: 0.4, deduct: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduct: 35_940_000 },
  { limit: Infinity, rate: 0.45, deduct: 65_940_000 },
];

export type IncomeTaxEstimate = {
  소득금액: number;
  본인공제: number;
  과세표준: number;
  세율: number;
  산출세액: number;
  표준세액공제: number;
  결정세액: number; // 국세
  지방소득세: number; // 결정세액의 10%
  총부담: number;
};

// 간이 추정: 소득금액 - 본인기본공제(150만) = 과표, 누진세율 적용,
// 표준세액공제 7만(증빙 없을 때 가정). 실제는 부양·연금·기납부 등으로 달라짐.
export function estimateIncomeTax(소득금액: number): IncomeTaxEstimate {
  const 본인공제 = 1_500_000;
  const 과세표준 = Math.max(0, 소득금액 - 본인공제);
  const bracket = 누진표.find((b) => 과세표준 <= b.limit)!;
  const 산출세액 = Math.max(0, 과세표준 * bracket.rate - bracket.deduct);
  const 표준세액공제 = 산출세액 > 0 ? 70_000 : 0;
  const 결정세액 = Math.max(0, Math.floor((산출세액 - 표준세액공제) / 10) * 10);
  const 지방소득세 = Math.floor((결정세액 * 0.1) / 10) * 10;
  return {
    소득금액,
    본인공제,
    과세표준,
    세율: bracket.rate,
    산출세액,
    표준세액공제,
    결정세액,
    지방소득세,
    총부담: 결정세액 + 지방소득세,
  };
}

// ── 연도별 손익 (경영용 / 세무용 동시 계산) ──────────────────────
// 경영순이익 = 매출 - 외주용역비 - 직접경비 - 공통경비 - 감가상각 - 대표인건비
// 세무소득금액 = 위에서 대표인건비를 빼지 않은 값 (대표 인출은 필요경비 불산입)
export type YearFinancials = {
  매출: number;
  외주용역비: number; // 용역비(타인)
  직접경비: number; // 프로젝트 직접경비
  공통경비: number; // 판관비 (영업외 제외)
  감가상각: number;
  영업외수익: number;
  영업외비용: number;
  대표인건비: number; // 대표인출
  경영순이익: number; // ← 대시보드 (대표 인건비 차감)
  세무소득금액: number; // ← 세금 탭 (대표 인건비 미차감)
};

// 입금완료(=세금계산서 발행된 확정 매출) 판정
export function isPaidProject(정산상태: string): boolean {
  return 정산상태.includes("입금");
}

// 자산별 기간(prefix) 감가상각. prefix="2026"(연) 또는 "2026-06"(월)
function depreciationForPrefix(ledger: Ledger, prefix: string): number {
  const pad = (x: number) => String(x).padStart(2, "0");
  const months =
    prefix.length <= 4
      ? Array.from({ length: 12 }, (_, i) => `${prefix}-${pad(i + 1)}`)
      : [prefix];
  let sum = 0;
  for (const a of ledger.assets) {
    if (!a.취득일 || !a.월감가상각) continue;
    const acq = a.취득일.slice(0, 7); // 취득월(미산입)
    const end = a.종료일 ? a.종료일.slice(0, 7) : "9999-12";
    for (const ym of months) if (ym > acq && ym <= end) sum += a.월감가상각;
  }
  return sum;
}

// 기간별 손익 계산. prefix="2026"(연도) 또는 "2026-06"(월).
// 매출은 '입금완료' 프로젝트만(미입금/미래 계약 제외), 비용은 실제 지출일 기준.
export function computeFinancials(
  ledger: Ledger,
  prefix: string
): YearFinancials {
  const inP = (d: string) => !!d && d.startsWith(prefix);

  let 매출 = 0;
  for (const p of ledger.projects) {
    if (isPaidProject(p.정산상태) && inP(p.납품일)) 매출 += p.공급가;
  }
  let 외주 = 0,
    직접경비 = 0,
    대표 = 0;
  for (const c of ledger.project_costs) {
    if (!inP(c.지출일)) continue;
    if (c.구분 === "용역비") 외주 += c.금액;
    else if (c.구분 === "대표인출") 대표 += c.금액;
    else 직접경비 += c.금액;
  }
  let 공통 = 0,
    외수 = 0,
    외비 = 0;
  for (const e of ledger.common_expenses) {
    if (!inP(e.지출일)) continue;
    if (e.구분 === "영업외수익") 외수 += e.금액;
    else if (e.구분 === "영업외비용") 외비 += e.금액;
    else 공통 += e.금액;
  }
  const 감가 = depreciationForPrefix(ledger, prefix);
  const 세무소득금액 = 매출 - 외주 - 직접경비 - 공통 - 감가 + 외수 - 외비;
  return {
    매출,
    외주용역비: 외주,
    직접경비,
    공통경비: 공통,
    감가상각: 감가,
    영업외수익: 외수,
    영업외비용: 외비,
    대표인건비: 대표,
    세무소득금액,
    경영순이익: 세무소득금액 - 대표,
  };
}

export function financialsByYear(
  ledger: Ledger
): Record<string, YearFinancials> {
  const years = new Set<string>();
  for (const p of ledger.projects) if (p.납품일) years.add(p.납품일.slice(0, 4));
  for (const c of ledger.project_costs)
    if (c.지출일) years.add(c.지출일.slice(0, 4));
  const out: Record<string, YearFinancials> = {};
  for (const y of years) out[y] = computeFinancials(ledger, y);
  return out;
}

// 데이터에 존재하는 월(YYYY-MM) 목록 — 기간 선택용
export function availableMonths(ledger: Ledger): string[] {
  const m = new Set<string>();
  for (const p of ledger.projects)
    if (isPaidProject(p.정산상태) && p.납품일) m.add(p.납품일.slice(0, 7));
  for (const c of ledger.project_costs) if (c.지출일) m.add(c.지출일.slice(0, 7));
  for (const e of ledger.common_expenses)
    if (e.지출일) m.add(e.지출일.slice(0, 7));
  return [...m].filter((x) => x.length === 7).sort((a, b) => b.localeCompare(a));
}

// ── 세무용: 공제 가능 비용(필요경비)만 집계 ──────────────────────
// 대시보드(경영)와 분리. 식비·해외여행 등 공제불가는 제외.
// 이중계상 방지: 외주업체 용역비는 세금계산서매입에서만, 프리랜서는 project_costs에서만.
export type Deductible = {
  세금계산서매입: number; // 외주업체 + 장비 + 임차 등 (세금계산서 받은 것)
  카드매입: number; // 사업용 카드 공급가
  프리랜서인건비: number; // 3.3% 프리랜서(배당 포함)
  감가상각: number;
  합계: number;
};

export function deductibleByYear(ledger: Ledger): Record<string, Deductible> {
  const out: Record<string, Deductible> = {};
  const ensure = (y: string) =>
    (out[y] ??= {
      세금계산서매입: 0,
      카드매입: 0,
      프리랜서인건비: 0,
      감가상각: 0,
      합계: 0,
    });

  for (const inv of ledger.tax_invoices) {
    if (inv.구분 !== "매입" || !inv.작성일) continue;
    ensure(inv.작성일.slice(0, 4)).세금계산서매입 += inv.공급가;
  }
  for (const c of ledger.card_input_vat) {
    const y = String(c.연도).slice(0, 4);
    if (y.length === 4) ensure(y).카드매입 += c.공급가;
  }
  // 매출 연도도 포함 (감가/프리랜서 빠짐 방지)
  for (const inv of ledger.tax_invoices)
    if (inv.구분 === "매출" && inv.작성일) ensure(inv.작성일.slice(0, 4));

  // 프리랜서 인건비: 공식 payroll 우선, 그 연도 공식자료 없으면 project_costs 폴백
  const payByYear: Record<string, number> = {};
  for (const p of ledger.payroll)
    if (p.귀속연월)
      payByYear[p.귀속연월.slice(0, 4)] =
        (payByYear[p.귀속연월.slice(0, 4)] ?? 0) + p.지급액;
  const pcByYear: Record<string, number> = {};
  const fl = freelancerSet(ledger);
  for (const c of ledger.project_costs)
    if (c.구분 === "용역비" && fl.has(c.파트너) && c.지출일)
      pcByYear[c.지출일.slice(0, 4)] =
        (pcByYear[c.지출일.slice(0, 4)] ?? 0) + c.금액;

  for (const [y, d] of Object.entries(out)) {
    d.프리랜서인건비 = payByYear[y] ?? pcByYear[y] ?? 0;
    d.감가상각 = depreciationForPrefix(ledger, y);
    d.합계 = d.세금계산서매입 + d.카드매입 + d.프리랜서인건비 + d.감가상각;
  }
  return out;
}

// 세무 매출 = 세금계산서 발행분 (신고 기준 총수입금액)
export function invoicedRevenueByYear(ledger: Ledger): Record<string, number> {
  const out: Record<string, number> = {};
  for (const inv of ledger.tax_invoices) {
    if (inv.구분 !== "매출" || !inv.작성일) continue;
    const y = inv.작성일.slice(0, 4);
    out[y] = (out[y] ?? 0) + inv.공급가;
  }
  return out;
}

// 세무용 소득금액 = 세금계산서 매출 − 공제 가능 비용 (종소세 계산용)
export function taxableIncomeByYear(ledger: Ledger): Record<string, number> {
  const rev = invoicedRevenueByYear(ledger);
  const ded = deductibleByYear(ledger);
  const years = new Set([...Object.keys(rev), ...Object.keys(ded)]);
  const out: Record<string, number> = {};
  for (const y of years) out[y] = (rev[y] ?? 0) - (ded[y]?.합계 ?? 0);
  return out;
}
