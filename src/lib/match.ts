// 시트 행 매칭용 값 비교 — 삭제/수정 시 정규화된 화면값과 시트 raw값을 안전하게 대조.
// 특히 project_costs.지출일 처럼 구글시트가 "2026-06-12" 텍스트를 날짜 serial 숫자로
// 바꿔 저장한 경우, 화면에 보이는 YYYY-MM-DD 로 매칭하면 문자열이 안 맞아 삭제가
// 조용히 실패한다. 날짜는 YYYY-MM-DD 로 맞춰 비교해 이 불일치를 흡수한다.

// 엑셀 serial(1899-12-30 기준) → YYYY-MM-DD (타임존 영향 없음)
function serialToYMD(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000); // 25569 = 1970-01-01
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 값이 날짜면 YYYY-MM-DD, 아니면 "" 반환. (금액 등 큰 숫자는 serial 범위 밖 → "")
function ymd(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    return v > 20000 && v < 100000 ? serialToYMD(v) : "";
  }
  const s = String(v).trim();
  // 순수 숫자 문자열 = 엑셀 serial (구글시트가 날짜를 serial 문자열로 반환)
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n > 20000 && n < 100000 ? serialToYMD(n) : "";
  }
  // 문자열 날짜: "2026-06-12", "2026. 6. 12", "2026/6/12" 등
  const m = s.match(/^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return "";
}

/** 시트 셀값 a 와 매칭값 b 가 같은지. 문자열이 같거나, 둘 다 같은 날짜면 true. */
export function cellEq(a: unknown, b: unknown): boolean {
  if (String(a) === String(b)) return true;
  const ay = ymd(a);
  return ay !== "" && ay === ymd(b);
}

/** get(컬럼명) 으로 얻은 행이 match 의 모든 컬럼과 일치하는지 (날짜 형식 차이 흡수). */
export function rowMatches(
  get: (k: string) => unknown,
  match: Record<string, string | number>
): boolean {
  return Object.entries(match).every(([k, v]) => cellEq(get(k), v));
}
