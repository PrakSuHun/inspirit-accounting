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

async function getToken(): Promise<string> {
  const auth = getAuth();
  await auth.authorize();
  const t = auth.credentials.access_token;
  if (!t) throw new Error("구글 인증 토큰 발급 실패");
  return t;
}

// 모든 탭을 한 번의 batchGet 으로 로드 (호출수 14→2, 쿼터 안전 + 캐시 불필요).
// UNFORMATTED_VALUE: 날짜=serial숫자, 금액=숫자 (toDateStr/toNum이 처리)
export async function sheetsRawRows(): Promise<
  Record<string, Record<string, unknown>[]>
> {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID 환경변수가 없습니다.");
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };

  // 1) 존재하는 시트 목록
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties.title`,
    { headers }
  );
  if (!metaRes.ok)
    throw new Error(`Sheets meta ${metaRes.status}: ${await metaRes.text()}`);
  const meta = await metaRes.json();
  const existing = new Set<string>(
    (meta.sheets ?? []).map(
      (s: { properties: { title: string } }) => s.properties.title
    )
  );
  const tabs = SHEET_TABS.filter((t) => existing.has(t));

  const out: Record<string, Record<string, unknown>[]> = {};
  for (const t of SHEET_TABS) out[t] = [];
  if (tabs.length === 0) return out;

  // 2) 한 번에 모든 탭 값 가져오기
  const qs =
    tabs.map((t) => `ranges=${encodeURIComponent(t)}`).join("&") +
    "&valueRenderOption=UNFORMATTED_VALUE";
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?${qs}`,
    { headers }
  );
  if (!res.ok)
    throw new Error(`Sheets batchGet ${res.status}: ${await res.text()}`);
  const data = await res.json();

  (data.valueRanges ?? []).forEach(
    (vr: { values?: unknown[][] }, i: number) => {
      const t = tabs[i];
      const values = vr.values ?? [];
      if (values.length === 0) return;
      const hdr = (values[0] as unknown[]).map((h) => String(h));
      out[t] = values.slice(1).map((row) => {
        const obj: Record<string, unknown> = {};
        hdr.forEach((h, j) => {
          obj[h] = (row as unknown[])[j] ?? "";
        });
        return obj;
      });
    }
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
