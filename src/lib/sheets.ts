import "server-only";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// ── Google Sheets 어댑터 (배포/클라우드 데이터 소스) ──────────────
// 서비스 계정으로 인증해 시트를 DB처럼 읽고 씀.

export const SHEET_TABS = [
  "accounts",
  "clients",
  "partners",
  "projects",
  "project_costs",
  "bank_transactions",
  "tax_invoices",
  "common_expenses",
  "card_input_vat",
  "assets",
  "tax_settings",
  "payroll",
  "wh_filings",
];

function getAuth(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "구글시트 인증 정보가 없습니다. GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY 환경변수를 설정하세요."
    );
  }
  return new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getDoc(): Promise<GoogleSpreadsheet> {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID 환경변수가 없습니다.");
  const doc = new GoogleSpreadsheet(id, getAuth());
  await doc.loadInfo();
  return doc;
}

// 모든 탭을 {탭명: 행객체[]} 로 (병렬 로드)
export async function sheetsRawRows(): Promise<
  Record<string, Record<string, unknown>[]>
> {
  const doc = await getDoc();
  const out: Record<string, Record<string, unknown>[]> = {};
  await Promise.all(
    SHEET_TABS.map(async (name) => {
      const sheet = doc.sheetsByTitle[name];
      if (!sheet) {
        out[name] = [];
        return;
      }
      const rows = await sheet.getRows();
      const headers = sheet.headerValues ?? [];
      out[name] = rows.map((r) => {
        const obj: Record<string, unknown> = {};
        for (const h of headers) obj[h] = r.get(h);
        return obj;
      });
    })
  );
  return out;
}

// 행 추가 (시트 없으면 생성)
export async function sheetsAppendRows(
  name: string,
  newRows: Record<string, string | number>[]
): Promise<number> {
  if (newRows.length === 0) return 0;
  const doc = await getDoc();
  let sheet = doc.sheetsByTitle[name];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: name,
      headerValues: Object.keys(newRows[0]),
    });
  }
  await sheet.addRows(newRows);
  return newRows.length;
}

// keyCol === keyVal 인 행을 patch 로 갱신
export async function sheetsUpdateRow(
  name: string,
  keyCol: string,
  keyVal: string,
  patch: Record<string, string | number>
): Promise<boolean> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[name];
  if (!sheet) {
    await sheetsAppendRows(name, [{ [keyCol]: keyVal, ...patch }]);
    return true;
  }
  const rows = await sheet.getRows();
  const row = rows.find((r) => String(r.get(keyCol)) === keyVal);
  if (!row) return false;
  for (const [k, v] of Object.entries(patch)) row.set(k, v as string | number);
  await row.save();
  return true;
}

// match 의 모든 컬럼이 일치하는 첫 행 삭제
export async function sheetsDeleteRowByMatch(
  name: string,
  match: Record<string, string | number>
): Promise<boolean> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[name];
  if (!sheet) return false;
  const rows = await sheet.getRows();
  const row = rows.find((r) =>
    Object.entries(match).every(([k, v]) => String(r.get(k)) === String(v))
  );
  if (!row) return false;
  await row.delete();
  return true;
}
