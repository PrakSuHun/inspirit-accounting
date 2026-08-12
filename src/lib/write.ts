import "server-only";
import * as XLSX from "xlsx";
import fs from "node:fs";
import { rowMatches } from "./match";

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

/** match 의 모든 컬럼이 일치하는 '모든' 행을 patch 로 갱신. 갱신된 행 수 반환. */
export async function updateRowsByMatch(
  sheetName: string,
  match: Record<string, string | number>,
  patch: Record<string, string | number>,
  raw = false
): Promise<number> {
  if (useSheets()) {
    const { sheetsUpdateRowsByMatch } = await import("./sheets");
    return sheetsUpdateRowsByMatch(sheetName, match, patch, raw);
  }
  const wb = readWb();
  const ws = wb.Sheets[sheetName];
  if (!ws) return 0;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: true,
  });
  let n = 0;
  for (const r of rows) {
    if (rowMatches((k) => r[k], match)) {
      Object.assign(r, patch);
      n++;
    }
  }
  if (n > 0) {
    wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
    writeWb(wb);
  }
  return n;
}

/**
 * 프로젝트명 변경 + 연결 전파(cascade).
 * projects 행 이름과, 그 이름을 참조하는 project_costs·andone·tax_invoices 를 한 번에 변경.
 * → 인건비·앤드원·세금계산서 연결이 끊기지 않음.
 */
export async function renameProject(
  oldName: string,
  newName: string
): Promise<{
  project: boolean;
  costs: number;
  andone: number;
  invoices: number;
}> {
  const old = oldName.trim();
  const nw = newName.trim();
  if (!old || !nw || old === nw) {
    return { project: false, costs: 0, andone: 0, invoices: 0 };
  }
  // 1) projects 행의 이름 (raw=true: 날짜 재해석 방지)
  const project = await updateRow(
    "projects",
    "프로젝트명(내부)",
    old,
    { "프로젝트명(내부)": nw },
    true
  );
  // 2) project_costs (인건비/용역비·경비·대표인출)
  const costs = await updateRowsByMatch(
    "project_costs",
    { 프로젝트: old },
    { 프로젝트: nw },
    true
  );
  // 3) andone — 청구행은 내용==프로젝트명 이라 둘 다, 나머지(수령)는 프로젝트만
  const claim = await updateRowsByMatch(
    "andone",
    { 프로젝트: old, 내용: old },
    { 프로젝트: nw, 내용: nw },
    true
  );
  const rest = await updateRowsByMatch(
    "andone",
    { 프로젝트: old },
    { 프로젝트: nw },
    true
  );
  // 4) tax_invoices 프로젝트매핑
  const invoices = await updateRowsByMatch(
    "tax_invoices",
    { 프로젝트매핑: old },
    { 프로젝트매핑: nw },
    true
  );
  return { project, costs, andone: claim + rest, invoices };
}

/**
 * 앤드원 항목의 집계제외 플래그 설정. 삭제하지 않고 미수/합계 계산에서만 뺌.
 * match 로 해당 행을 찾아 집계제외 컬럼을 "Y"(제외) 또는 ""(포함) 로 설정.
 * 시트에 컬럼이 없으면 자동 추가. 갱신된 행 수 반환.
 */
export async function setAndoneExclude(
  match: Record<string, string | number>,
  excluded: boolean
): Promise<number> {
  const value = excluded ? "Y" : "";
  if (useSheets()) {
    const { sheetsSetFlag } = await import("./sheets");
    return sheetsSetFlag("andone", match, "집계제외", value);
  }
  // 로컬 xlsx: json_to_sheet 가 새 컬럼을 자동 포함
  return updateRowsByMatch("andone", match, { 집계제외: value }, true);
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
  const idx = rows.findIndex((r) => rowMatches((k) => r[k], match));
  if (idx < 0) return false;
  rows.splice(idx, 1);
  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
  writeWb(wb);
  return true;
}

/** match 의 모든 컬럼이 일치하는 '모든' 행을 삭제. 삭제된 행 수 반환. */
export async function deleteRowsByMatch(
  sheetName: string,
  match: Record<string, string | number>
): Promise<number> {
  if (useSheets()) {
    const { sheetsDeleteRowsByMatch } = await import("./sheets");
    return sheetsDeleteRowsByMatch(sheetName, match);
  }
  const wb = readWb();
  const ws = wb.Sheets[sheetName];
  if (!ws) return 0;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: true,
  });
  const kept = rows.filter((r) => !rowMatches((k) => r[k], match));
  const n = rows.length - kept.length;
  if (n > 0) {
    wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(kept);
    writeWb(wb);
  }
  return n;
}

/**
 * 프로젝트 삭제 + 연결 정리(cascade).
 * projects 행과, 그 프로젝트에 연결된 project_costs(인건비/용역비·경비·대표인출)·
 * andone 정산행을 함께 삭제. tax_invoices 는 공식 발급기록이라 지우지 않고
 * 프로젝트매핑만 비워서(연결 해제) 세금 집계는 유지.
 * → 삭제 후 인건비 탭 등에 고아 데이터가 남지 않음.
 */
export async function deleteProject(name: string): Promise<{
  project: boolean;
  costs: number;
  andone: number;
  invoicesUnlinked: number;
}> {
  const nm = name.trim();
  if (!nm) return { project: false, costs: 0, andone: 0, invoicesUnlinked: 0 };
  const project = await deleteRowByMatch("projects", {
    "프로젝트명(내부)": nm,
  });
  const costs = await deleteRowsByMatch("project_costs", { 프로젝트: nm });
  const andone = await deleteRowsByMatch("andone", { 프로젝트: nm });
  const invoicesUnlinked = await updateRowsByMatch(
    "tax_invoices",
    { 프로젝트매핑: nm },
    { 프로젝트매핑: "" },
    true
  );
  return { project, costs, andone, invoicesUnlinked };
}
