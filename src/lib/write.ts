import "server-only";
import * as XLSX from "xlsx";
import fs from "node:fs";
import { clearLedgerCache } from "./data";

const XLSX_PATH = process.env.XLSX_PATH ?? "";
const useSheets = () => (process.env.DATA_SOURCE ?? "xlsx") === "sheets";

// 쓰기 후 캐시 무효화 → 다음 읽기에 즉시 반영
function bust() {
  clearLedgerCache();
}

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
  patch: Record<string, string | number>
): Promise<boolean> {
  if (useSheets()) {
    const { sheetsUpdateRow } = await import("./sheets");
    const ok = await sheetsUpdateRow(sheetName, keyCol, keyVal, patch);
    bust();
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
  newRows: Record<string, string | number>[]
): Promise<number> {
  if (newRows.length === 0) return 0;
  if (useSheets()) {
    const { sheetsAppendRows } = await import("./sheets");
    const n = await sheetsAppendRows(sheetName, newRows);
    bust();
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

/** match 의 모든 컬럼이 일치하는 첫 행을 삭제 */
export async function deleteRowByMatch(
  sheetName: string,
  match: Record<string, string | number>
): Promise<boolean> {
  if (useSheets()) {
    const { sheetsDeleteRowByMatch } = await import("./sheets");
    const ok = await sheetsDeleteRowByMatch(sheetName, match);
    bust();
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
