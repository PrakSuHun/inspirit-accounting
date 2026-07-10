import "server-only";
import * as XLSX from "xlsx";
import fs from "node:fs";

const XLSX_PATH = process.env.XLSX_PATH ?? "";
const useSheets = () => (process.env.DATA_SOURCE ?? "xlsx") === "sheets";

function readWb(): XLSX.WorkBook {
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    throw new Error(`엑셀 파일 없음: ${XLSX_PATH}`);
  }
  return XLSX.read(fs.readFileSync(XLSX_PATH));
}

function writeWb(wb: XLSX.WorkBook): void {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(XLSX_PATH, buf);
}

/** keyCol === keyVal 행을 patch 로 갱신 (없으면 sheets는 추가) */
export async function updateRow(
  sheetName: string,
  keyCol: string,
  keyVal: string,
  patch: Record<string, string | number>,
  raw = false
): Promise<boolean> {
  if (useSheets()) {
    const { sheetsUpdateRow } = await import("./sheets");
    const ok = await sheetsUpdateRow(sheetName, keyCol, keyVal, patch, raw);
    return ok;
  }
  const wb = readWb();
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`시트 없음: ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: true,
  });
  let found = false;
  for (const r of rows) {
    if (String(r[keyCol]) === keyVal) {
      Object.assign(r, patch);
      found = true;
      break;
    }
  }
  if (!found) return false;
  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
  writeWb(wb);
  return true;
}

/** 시트에 새 행 추가 (없으면 시트 생성) */
export async function appendRows(
  sheetName: string,
  newRows: Record<string, string | number>[],
  raw = false
): Promise<number> {
  if (newRows.length === 0) return 0;
  if (useSheets()) {
    const { sheetsAppendRows } = await import("./sheets");
    const n = await sheetsAppendRows(sheetName, newRows, raw);
    return n;
  }
  const wb = readWb();
  const ws = wb.Sheets[sheetName];
  const rows = ws
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
        raw: true,
      })
    : [];
  const merged = [...rows, ...newRows];
  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(merged);
  if (!ws) wb.SheetNames.push(sheetName);
  writeWb(wb);
  return newRows.length;
}

/** 원천세 신고 상태 설정(귀속월 단위). 기존 행 정리 후 filed 면 한 행만 기록. */
export async function setFiling(
  귀속월: string,
  filed: boolean,
  신고일: string
): Promise<void> {
  if (useSheets()) {
    const { sheetsSetFiling } = await import("./sheets");
    await sheetsSetFiling(귀속월, filed, 신고일);
    return;
  }
  // 로컬 xlsx: 같은 귀속월 행 제거 후 filed 면 추가
  try {
    while (await deleteRowByMatch("wh_filings", { 귀속월 })) {
      /* 중복 전부 제거 */
    }
  } catch {
    /* 시트 없음 무시 */
  }
  if (filed) {
    await appendRows("wh_filings", [{ 귀속월, 신고여부: "완료", 신고일 }]);
  }
}

/** match 의 모든 컬럼이 일치하는 첫 행을 삭제 */
export async function deleteRowByMatch(
  sheetName: string,
  match: Record<string, string | number>
): Promise<boolean> {
  if (useSheets()) {
    const { sheetsDeleteRowByMatch } = await import("./sheets");
    const ok = await sheetsDeleteRowByMatch(sheetName, match);
    return ok;
  }
  const wb = readWb();
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`시트 없음: ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: true,
  });
  const idx = rows.findIndex((r) =>
    Object.entries(match).every(([k, v]) => String(r[k]) === String(v))
  );
  if (idx < 0) return false;
  rows.splice(idx, 1);
  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
  writeWb(wb);
  return true;
}
