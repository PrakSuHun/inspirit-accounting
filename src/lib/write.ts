import "server-only";
import * as XLSX from "xlsx";
import fs from "node:fs";

const XLSX_PATH = process.env.XLSX_PATH ?? "";

/**
 * 시트의 특정 행(keyCol === keyVal)을 찾아 patch 의 컬럼들을 갱신.
 * 로컬 xlsx 직접 수정. (배포 시 Google Sheets API batchUpdate 로 교체)
 */
export function updateRow(
  sheetName: string,
  keyCol: string,
  keyVal: string,
  patch: Record<string, string | number>
): boolean {
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    throw new Error(`엑셀 파일 없음: ${XLSX_PATH}`);
  }
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
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

  const newWs = XLSX.utils.json_to_sheet(rows);
  wb.Sheets[sheetName] = newWs;
  writeWorkbook(wb);
  return true;
}

/** 시트에 새 행 추가 (대조 엔진 업로드 등) */
export function appendRows(
  sheetName: string,
  newRows: Record<string, string | number>[]
): number {
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    throw new Error(`엑셀 파일 없음: ${XLSX_PATH}`);
  }
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
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
  writeWorkbook(wb);
  return newRows.length;
}

/** match 의 모든 컬럼이 일치하는 첫 행을 삭제 */
export function deleteRowByMatch(
  sheetName: string,
  match: Record<string, string | number>
): boolean {
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    throw new Error(`엑셀 파일 없음: ${XLSX_PATH}`);
  }
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH));
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
  writeWorkbook(wb);
  return true;
}

function writeWorkbook(wb: XLSX.WorkBook): void {
  // Next.js 번들러 환경: XLSX.writeFile 대신 버퍼로 써서 fs 로 저장
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(XLSX_PATH, buf);
}
