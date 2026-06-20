import "server-only";
import * as XLSX from "xlsx";
import fs from "node:fs";
import type {
  Ledger,
  Project,
  ProjectCost,
  BankTransaction,
  Account,
} from "./types";

// ── 데이터 소스 추상화 ───────────────────────────────────────────
// 로컬 개발: XLSX_PATH 의 엑셀 파일을 직접 읽음.
// 배포(추후): DATA_SOURCE=sheets 로 바꾸면 Google Sheets API 사용 (sheets.ts).

const XLSX_PATH = process.env.XLSX_PATH ?? "";

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[, ₩]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// 엑셀 serial(1899-12-30 기준 일수) → YYYY-MM-DD. 타임존 영향 없음.
function excelSerialToYMD(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = 1970-01-01
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateStr(v: unknown): string {
  if (v == null || v === "") return "";
  // 엑셀에서 읽으면 날짜는 serial 숫자. (cellDates 는 타임존 버그로 하루 밀림 → 안 씀)
  if (typeof v === "number") return v > 0 ? excelSerialToYMD(v) : "";
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // 순수 숫자 문자열 = 엑셀 serial (구글시트는 날짜를 serial 문자열로 반환)
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 100000) return excelSerialToYMD(n);
  }
  // 문자열 날짜: "2026-01-01", "2026. 1. 1", "2026/1/1" 등
  const m = s.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

type RawData = Record<string, Record<string, unknown>[]>;

// 구글시트 읽기 캐싱(모듈 메모리, TTL): 매 페이지마다 13탭 재호출 → 쿼터초과 방지 + 속도.
// 쓰기 시 clearLedgerCache()로 즉시 무효화.
let _sheetCache: { data: RawData; ts: number } | null = null;
const CACHE_TTL_MS = 20_000;
export function clearLedgerCache(): void {
  _sheetCache = null;
}

// 데이터 소스 추상화: sheets(클라우드) 또는 xlsx(로컬). 모든 탭을 행객체 배열로.
async function getRawRows(): Promise<RawData> {
  if ((process.env.DATA_SOURCE ?? "xlsx") === "sheets") {
    if (_sheetCache && Date.now() - _sheetCache.ts < CACHE_TTL_MS) {
      return _sheetCache.data;
    }
    const { sheetsRawRows } = await import("./sheets");
    const data = await sheetsRawRows();
    _sheetCache = { data, ts: Date.now() };
    return data;
  }
  // 로컬 xlsx (cellDates 안 씀 → 날짜는 serial 로 읽고 변환)
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    throw new Error(
      `엑셀 파일을 찾을 수 없습니다: ${XLSX_PATH}\n.env.local 의 XLSX_PATH 를 확인하세요.`
    );
  }
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
  const out: RawData = {};
  for (const name of wb.SheetNames) {
    out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      defval: "",
      raw: true,
    });
  }
  return out;
}

// ── 전체 원장 로드 ───────────────────────────────────────────────
export async function loadLedger(): Promise<Ledger> {
  const raw = await getRawRows();
  const sheetRows = (name: string): Record<string, unknown>[] => raw[name] ?? [];

  const projects: Project[] = sheetRows("projects").map((r) => ({
    "프로젝트명(내부)": String(r["프로젝트명(내부)"] ?? ""),
    클라이언트: String(r["클라이언트"] ?? ""),
    납품일: toDateStr(r["납품일"]),
    상태: String(r["상태"] ?? ""),
    공급가: toNum(r["공급가"]),
    부가세: toNum(r["부가세"]),
    계약합계: toNum(r["계약합계"]),
    정산상태: String(r["정산상태"] ?? ""),
    계산서매핑: String(r["계산서매핑"] ?? ""),
  }));

  const project_costs: ProjectCost[] = sheetRows("project_costs").map(
    (r) => ({
      프로젝트: String(r["프로젝트"] ?? ""),
      구분: String(r["구분"] ?? ""),
      지출일: toDateStr(r["지출일"]),
      내용: String(r["내용"] ?? ""),
      금액: toNum(r["금액"]),
      파트너: String(r["파트너"] ?? ""),
      지급여부: String(r["지급여부"] ?? ""),
      선금여부: String(r["선금여부"] ?? ""),
    })
  );

  const bank_transactions: BankTransaction[] = sheetRows(
    "bank_transactions"
  ).map((r) => ({
    해시: String(r["해시"] ?? ""),
    계좌: String(r["계좌"] ?? ""),
    거래일시: toDateStr(r["거래일시"]),
    입출: String(r["입출"] ?? ""),
    금액: toNum(r["금액"]),
    거래후잔액: toNum(r["거래후잔액"]),
    거래구분: String(r["거래구분"] ?? ""),
    상대방: String(r["상대방"] ?? ""),
    메모: String(r["메모"] ?? ""),
    자동분류: String(r["자동분류"] ?? ""),
    매칭상태: String(r["매칭상태"] ?? ""),
    매칭ID: String(r["매칭ID"] ?? ""),
  }));

  const accounts: Account[] = sheetRows("accounts").map((r) => ({
    계좌명: String(r["계좌명"] ?? ""),
    은행: String(r["은행"] ?? ""),
    용도: String(r["용도"] ?? ""),
    세이프박스: String(r["세이프박스"] ?? ""),
    메모: String(r["메모"] ?? ""),
  }));

  return {
    accounts,
    clients: sheetRows("clients").map((r) => ({
      거래처명: String(r["거래처명"] ?? ""),
      사업자번호: String(r["사업자번호"] ?? ""),
      메모: String(r["메모"] ?? ""),
    })),
    partners: sheetRows("partners").map((r) => ({
      이름: String(r["이름"] ?? ""),
      소득구분: String(r["소득구분"] ?? ""),
      역할: String(r["역할"] ?? ""),
      상태: String(r["상태"] ?? ""),
      주민번호: String(r["주민번호"] ?? ""),
    })),
    projects,
    project_costs,
    bank_transactions,
    tax_invoices: sheetRows("tax_invoices").map((r) => ({
      구분: String(r["구분"] ?? ""),
      작성일: toDateStr(r["작성일"]),
      승인번호: String(r["승인번호"] ?? ""),
      거래처: String(r["거래처"] ?? ""),
      공급가: toNum(r["공급가"]),
      세액: toNum(r["세액"]),
      합계: toNum(r["합계"]),
      계산서품명: String(r["계산서품명"] ?? ""),
      종류: String(r["종류"] ?? ""),
      프로젝트매핑: String(r["프로젝트매핑"] ?? ""),
    })),
    common_expenses: sheetRows("common_expenses").map((r) => ({
      지출일: toDateStr(r["지출일"]),
      구분: String(r["구분"] ?? ""),
      항목: String(r["항목"] ?? ""),
      금액: toNum(r["금액"]),
    })),
    card_input_vat: sheetRows("card_input_vat").map((r) => ({
      연도: String(r["연도"] ?? ""),
      가맹점: String(r["가맹점"] ?? ""),
      사업자번호: String(r["사업자번호"] ?? ""),
      공급가: toNum(r["공급가"]),
      매입세액: toNum(r["매입세액"]),
      비과세: toNum(r["비과세"]),
      합계: toNum(r["합계"]),
      유형: String(r["유형"] ?? ""),
    })),
    assets: sheetRows("assets").map((r) => ({
      취득일: toDateStr(r["취득일"]),
      품명: String(r["품명"] ?? ""),
      취득가: toNum(r["취득가"]),
      상각방법: String(r["상각방법"] ?? ""),
      내용연수월: toNum(r["내용연수월"]),
      종료일: toDateStr(r["종료일"]),
      월감가상각: toNum(r["월감가상각"]),
    })),
    payroll: sheetRows("payroll").map((r) => {
      const ym = toDateStr(r["귀속연월"]).slice(0, 7);
      return {
      귀속연월: ym,
      지급일: toDateStr(r["지급일"]) || ym + "-15",
      수령인: String(r["수령인"] ?? ""),
      주민번호: String(r["주민번호"] ?? ""),
      지급액: toNum(r["지급액"]),
      국세: toNum(r["국세"]),
      지방소득세: toNum(r["지방소득세"]),
      업종: String(r["업종"] ?? ""),
      };
    }),
    tax_settings: sheetRows("tax_settings").map((r) => ({
      항목: String(r["항목"] ?? ""),
      값: String(r["값"] ?? ""),
      설명: String(r["설명"] ?? ""),
    })),
  };
}

// ── 원천세 신고 완료 상태 (wh_filings 탭, 없으면 빈 맵) ────────────
export async function loadFilings(): Promise<
  Record<string, { 신고여부: string; 신고일: string }>
> {
  const raw = await getRawRows();
  const out: Record<string, { 신고여부: string; 신고일: string }> = {};
  for (const r of raw["wh_filings"] ?? []) {
    const ym = String(r["귀속월"] ?? "");
    if (!ym) continue;
    out[ym] = {
      신고여부: String(r["신고여부"] ?? ""),
      신고일: String(r["신고일"] ?? ""),
    };
  }
  return out;
}

// ── 프로젝트별 집계 (수익성) ──────────────────────────────────────
export type ProjectRollup = {
  project: Project;
  외주용역비: number; // 타인 용역비
  대표인출: number;
  경비: number;
  총원가_경영: number; // 외주+대표인출+경비
  총원가_세무: number; // 외주+경비 (대표인출 제외)
  마진_경영: number;
  마진율_경영: number;
  유형: "중개" | "자체제작";
  costs: ProjectCost[];
};

export function rollupProjects(ledger: Ledger): ProjectRollup[] {
  const byProject = new Map<string, ProjectCost[]>();
  for (const c of ledger.project_costs) {
    const arr = byProject.get(c.프로젝트) ?? [];
    arr.push(c);
    byProject.set(c.프로젝트, arr);
  }

  return ledger.projects.map((p) => {
    const costs = byProject.get(p["프로젝트명(내부)"]) ?? [];
    const 외주용역비 = costs
      .filter((c) => c.구분 === "용역비")
      .reduce((s, c) => s + c.금액, 0);
    const 대표인출 = costs
      .filter((c) => c.구분 === "대표인출")
      .reduce((s, c) => s + c.금액, 0);
    const 경비 = costs
      .filter((c) => c.구분 === "경비")
      .reduce((s, c) => s + c.금액, 0);
    const 총원가_경영 = 외주용역비 + 대표인출 + 경비;
    const 총원가_세무 = 외주용역비 + 경비;
    const 마진_경영 = p.공급가 - 총원가_경영;
    const 마진율_경영 = p.공급가 > 0 ? 마진_경영 / p.공급가 : 0;
    // 중개 판정: 외주용역비가 공급가의 70% 이상 → 받아서 넘긴 중개 건
    const 유형: "중개" | "자체제작" =
      p.공급가 > 0 && 외주용역비 / p.공급가 >= 0.7 ? "중개" : "자체제작";
    return {
      project: p,
      외주용역비,
      대표인출,
      경비,
      총원가_경영,
      총원가_세무,
      마진_경영,
      마진율_경영,
      유형,
      costs,
    };
  });
}

// ── 세이프박스 잔액 (선금통장 입출 누적) ─────────────────────────
export function safeboxBalance(ledger: Ledger): number {
  // 세이프박스 = Y 인 계좌
  const safeAccts = new Set(
    ledger.accounts.filter((a) => a.세이프박스 === "Y").map((a) => a.계좌명)
  );
  return ledger.bank_transactions
    .filter((t) => safeAccts.has(t.계좌))
    .reduce((s, t) => s + t.금액, 0);
}

// ── 사업자통장(공동) 총 비용 = 공통경비 ───────────────────────────
// 선금통장 제외. 내부이체·세금적립·저축·대표인출 같은 자금이동은 비용 아님 → 제외.
// year 지정 시 그 해만. (대시보드용 · 세금계산엔 사용 안 함)
// 공통경비 = 사업자통장 overhead만. 프리랜서 용역비·배당(외주비지급)은 지급명세서가
// 따로 잡으므로 제외. 자금이동·세금적립·대표인출·환전·4대보험도 제외.
export function businessAccountCost(ledger: Ledger, year?: string): number {
  const exclude = /내부이체|자금이동|인출|세금적립|저축|외주비지급/; // 외주비=프리랜서(지급명세서)
  const personal = /환전|국민건강|국민연금|사회보험/; // 대표 개인(환전·4대보험)
  return ledger.bank_transactions
    .filter(
      (t) =>
        t.계좌 === "사업자통장" &&
        t.입출 === "출금" &&
        !exclude.test(t.자동분류) &&
        !personal.test(t.상대방) &&
        (!year || t.거래일시.startsWith(year))
    )
    .reduce((s, t) => s + Math.abs(t.금액), 0);
}

// ── 사업자통장 실제 잔고 (통장 잔고 + 세이프박스) ─────────────────
// 사용자 정의 "순이익" = 공동(사업자)통장에 실제 있는 돈. 선금통장(개인)은 제외.
export function businessAccountBalance(ledger: Ledger): {
  합계: number;
  manual: boolean;
  갱신일: string;
} {
  const get = (k: string): number | null => {
    const r = ledger.tax_settings.find((s) => s.항목 === k);
    if (!r || r.값 === "") return null;
    const n = Number(String(r.값).replace(/[, 원]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const 갱신일 =
    ledger.tax_settings.find((s) => s.항목 === "사업자통장_갱신일")?.값 ?? "";

  // 우선순위 1: 앱에서 보고 입력한 실제값 (통장 + 세이프박스 = 모임통장 총액)
  const m잔고 = get("사업자통장_잔고");
  const m세박 = get("사업자통장_세이프박스");
  if (m잔고 != null) {
    return { 합계: m잔고 + (m세박 ?? 0), manual: true, 갱신일 };
  }

  // 폴백: 통장 거래내역 추정 (부정확)
  const tx = ledger.bank_transactions.filter((t) => t.계좌 === "사업자통장");
  let 잔고 = 0;
  for (const t of tx) 잔고 = t.거래후잔액;
  let into = 0,
    out = 0;
  for (const t of tx) {
    const isBox = /세이프박스|자유적금/.test(t.상대방) || /세금적립|저축/.test(t.자동분류);
    if (!isBox) continue;
    if (t.입출 === "출금") into += Math.abs(t.금액);
    else out += Math.abs(t.금액);
  }
  return { 합계: 잔고 + (into - out), manual: false, 갱신일 };
}

// ── 월별 매출 추이 ───────────────────────────────────────────────
export function monthlyRevenue(
  ledger: Ledger
): { month: string; 매출: number }[] {
  const m = new Map<string, number>();
  for (const p of ledger.projects) {
    if (!p.납품일) continue;
    if (!p.정산상태.includes("입금")) continue; // 입금완료분만
    const key = p.납품일.slice(0, 7); // YYYY-MM
    m.set(key, (m.get(key) ?? 0) + p.공급가);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, 매출]) => ({ month, 매출 }));
}
