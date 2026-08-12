import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { loadLedger, loadAndone } from "@/lib/data";
import {
  appendRows,
  updateRow,
  deleteRowByMatch,
  renameProject,
} from "@/lib/write";
import { won } from "@/lib/format";

// ── 인스피릿 장부 MCP 서버 ────────────────────────────────────────
// 코워크/클로드 앱(커스텀 커넥터)에서 자연어로 장부를 기록·수정.
// 기존 lib(loadLedger/appendRows 등)를 그대로 호출 → 계산·검증 로직 재활용.
// 인증: x-api-key 또는 Authorization: Bearer <MCP_TOKEN> 헤더.

const today = () => new Date().toISOString().slice(0, 10);
const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({
  content: [{ type: "text" as const, text }],
  isError: true,
});

// 프리랜서 upsert (인건비 지급 시 파트너 명단 관리 — /api/payroll 과 동일)
async function upsertFreelancer(이름: string, 주민번호: string) {
  const ledger = await loadLedger();
  const existing = ledger.partners.find((pt) => pt.이름 === 이름);
  if (!existing) {
    await appendRows("partners", [
      {
        이름,
        소득구분: "사업소득(3.3%)",
        역할: "프리랜서",
        상태: "활성",
        주민번호,
      },
    ]);
  } else if (!existing.주민번호 && 주민번호) {
    await updateRow("partners", "이름", 이름, { 주민번호 });
  }
}

const handler = createMcpHandler(
  (server) => {
    // ── 읽기 ──────────────────────────────────────────────────────
    server.registerTool(
      "list_projects",
      {
        title: "프로젝트 목록",
        description:
          "세금계산서 발급한 프로젝트 목록(이름·클라이언트·받을 금액[계약합계]·납품일·정산상태). 앤드원 청구 연결 전에 이름을 확인할 때 사용.",
        inputSchema: {},
      },
      async () => {
        try {
          const l = await loadLedger();
          const rows = l.projects
            .filter((p) => p["프로젝트명(내부)"])
            .map((p) => ({
              프로젝트: p["프로젝트명(내부)"],
              클라이언트: p.클라이언트,
              받을금액: p.계약합계 || p.공급가 + p.부가세,
              납품일: p.납품일,
              정산상태: p.정산상태,
            }));
          return ok(JSON.stringify(rows, null, 2));
        } catch (e) {
          return fail(`조회 실패: ${(e as Error).message}`);
        }
      }
    );

    server.registerTool(
      "andone_summary",
      {
        title: "앤드원 정산 현황",
        description:
          "앤드원 미수 현황: 받아야 할 돈(청구) 합계, 받은 돈(수령) 합계, 미수 차액과 각 항목 목록.",
        inputSchema: {},
      },
      async () => {
        try {
          const entries = await loadAndone();
          // 집계제외 표시된 건은 합계에서 제외 (앱 앤드원 탭과 동일)
          const 청구 = entries.filter((e) => e.구분 === "청구" && !e.집계제외);
          const 수령 = entries.filter((e) => e.구분 === "수령" && !e.집계제외);
          const 받을 = 청구.reduce((s, e) => s + e.금액, 0);
          const 받은 = 수령.reduce((s, e) => s + e.금액, 0);
          const summary = {
            미수차액: 받을 - 받은,
            받아야할돈합계: 받을,
            받은돈합계: 받은,
            받아야할돈: 청구.map((e) => ({
              날짜: e.날짜,
              내용: e.내용 || e.프로젝트,
              금액: e.금액,
              프로젝트: e.프로젝트,
            })),
            받은돈: 수령.map((e) => ({
              날짜: e.날짜,
              내용: e.내용,
              금액: e.금액,
              경로업체: e.경로업체,
            })),
          };
          return ok(JSON.stringify(summary, null, 2));
        } catch (e) {
          return fail(`조회 실패: ${(e as Error).message}`);
        }
      }
    );

    server.registerTool(
      "list_freelancers",
      {
        title: "프리랜서 명단",
        description: "인건비 지급 대상 프리랜서(사업소득 3.3%) 이름 목록.",
        inputSchema: {},
      },
      async () => {
        try {
          const l = await loadLedger();
          const names = [
            ...new Set(
              l.partners
                .filter((p) => p.소득구분?.includes("사업소득"))
                .map((p) => p.이름)
                .filter(Boolean)
            ),
          ];
          return ok(JSON.stringify(names, null, 2));
        } catch (e) {
          return fail(`조회 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 앤드원: 받아야 할 돈(청구) = 프로젝트 연결 ──────────────────
    server.registerTool(
      "add_andone_claim",
      {
        title: "앤드원 청구 추가(프로젝트 연결)",
        description:
          "세금계산서 발급한 프로젝트를 앤드원 '받아야 할 돈'으로 연결. 금액·날짜는 프로젝트에서 자동으로 가져옴(직접 입력 불필요). project 이름은 list_projects 의 정확한 프로젝트명을 사용.",
        inputSchema: {
          project: z.string().describe("연결할 프로젝트명(정확히 일치)"),
        },
      },
      async ({ project }) => {
        try {
          const [l, entries] = await Promise.all([loadLedger(), loadAndone()]);
          const p = l.projects.find(
            (x) => x["프로젝트명(내부)"] === project.trim()
          );
          if (!p) {
            const cand = l.projects
              .map((x) => x["프로젝트명(내부)"])
              .filter((n) => n && n.includes(project.trim()))
              .slice(0, 5);
            return fail(
              `'${project}' 프로젝트를 찾을 수 없습니다.${
                cand.length ? ` 비슷한 것: ${cand.join(", ")}` : " list_projects 로 정확한 이름을 확인하세요."
              }`
            );
          }
          const name = p["프로젝트명(내부)"];
          if (
            entries.some((e) => e.구분 === "청구" && e.프로젝트 === name)
          ) {
            return fail(`'${name}' 은(는) 이미 앤드원 청구로 연결돼 있습니다.`);
          }
          const 금액 = p.계약합계 || p.공급가 + p.부가세;
          await appendRows(
            "andone",
            [
              {
                날짜: p.납품일 || "",
                구분: "청구",
                내용: name,
                금액,
                경로업체: "",
                프로젝트: name,
              },
            ],
            true
          );
          return ok(
            `✅ 앤드원 청구 추가: ${name} ${won(금액)} (납품일 ${
              p.납품일 || "미정"
            }).`
          );
        } catch (e) {
          return fail(`추가 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 앤드원: 받은 돈(수령) = 직접 입력 ──────────────────────────
    server.registerTool(
      "add_andone_receipt",
      {
        title: "앤드원 받은 돈 추가",
        description:
          "다른 업체를 통해 받은 돈(부분 수령 포함)을 앤드원 정산에 기록. 금액은 필수, 날짜/경로업체/내용/프로젝트는 선택.",
        inputSchema: {
          금액: z.coerce.number().positive().describe("받은 금액(원)"),
          날짜: z.string().optional().describe("받은 날짜 YYYY-MM-DD (기본: 오늘)"),
          경로업체: z.string().optional().describe("어느 업체 통해 받았는지"),
          내용: z.string().optional().describe("무슨 건인지 메모"),
          프로젝트: z.string().optional().describe("연결 프로젝트(선택)"),
        },
      },
      async ({ 금액, 날짜, 경로업체, 내용, 프로젝트 }) => {
        try {
          await appendRows(
            "andone",
            [
              {
                날짜: 날짜 || today(),
                구분: "수령",
                내용: 내용 || "",
                금액,
                경로업체: 경로업체 || "",
                프로젝트: 프로젝트 || "",
              },
            ],
            true
          );
          return ok(
            `✅ 받은 돈 기록: ${won(금액)}${
              경로업체 ? ` (${경로업체} 통해)` : ""
            } · ${날짜 || today()}.`
          );
        } catch (e) {
          return fail(`추가 실패: ${(e as Error).message}`);
        }
      }
    );

    server.registerTool(
      "delete_andone_entry",
      {
        title: "앤드원 항목 삭제",
        description:
          "앤드원 정산에서만 항목을 삭제(프로젝트 기록엔 영향 없음). 정산 완료돼 정리하고 싶을 때 사용. andone_summary 로 확인한 값과 정확히 일치시켜야 함.",
        inputSchema: {
          구분: z.enum(["청구", "수령"]).describe("청구(받아야 할 돈) 또는 수령(받은 돈)"),
          금액: z.coerce.number().describe("삭제할 항목의 금액"),
          날짜: z.string().optional().describe("항목 날짜 YYYY-MM-DD"),
          내용: z.string().optional().describe("항목 내용(프로젝트명 등)"),
          경로업체: z.string().optional().describe("수령 항목의 경로업체"),
        },
      },
      async ({ 구분, 금액, 날짜, 내용, 경로업체 }) => {
        try {
          const match: Record<string, string | number> = { 구분, 금액 };
          if (날짜) match.날짜 = 날짜;
          if (내용) match.내용 = 내용;
          if (경로업체) match.경로업체 = 경로업체;
          const done = await deleteRowByMatch("andone", match);
          return done
            ? ok(`🗑️ 앤드원에서 삭제 완료 (${구분} ${won(금액)}). 프로젝트 기록은 그대로입니다.`)
            : fail("일치하는 항목을 찾지 못했습니다. andone_summary 로 값을 확인하세요.");
        } catch (e) {
          return fail(`삭제 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 인건비 지급 ────────────────────────────────────────────────
    server.registerTool(
      "add_payroll",
      {
        title: "인건비 지급 기록",
        description:
          "프리랜서에게 인건비 지급 기록(사업소득 3.3% 원천세는 앱에서 자동 계산). project_costs(용역비)로 저장되고 파트너 명단이 자동 관리됨.",
        inputSchema: {
          수령인: z.string().describe("받는 사람 이름"),
          금액: z.coerce.number().positive().describe("지급총액(세전, 원)"),
          날짜: z.string().optional().describe("지급일 YYYY-MM-DD (기본: 오늘)"),
          프로젝트: z.string().optional().describe("연결 프로젝트(기본: 인건비)"),
          선금: z
            .preprocess(
              (v) =>
                typeof v === "string"
                  ? v === "true" || v === "1" || v === "예"
                  : v,
              z.boolean()
            )
            .optional()
            .describe("선금통장 선지급 여부"),
          주민번호: z.string().optional().describe("주민번호(지급명세서용, 선택)"),
        },
      },
      async ({ 수령인, 금액, 날짜, 프로젝트, 선금, 주민번호 }) => {
        try {
          const name = 수령인.trim();
          if (주민번호) await upsertFreelancer(name, String(주민번호));
          await appendRows(
            "project_costs",
            [
              {
                프로젝트: 프로젝트 || "인건비",
                구분: "용역비",
                지출일: 날짜 || today(),
                내용: `인건비(${name})`,
                금액,
                파트너: name,
                지급여부: "지급 완료",
                선금여부: 선금 ? "선금" : "",
              },
            ],
            true // 날짜 텍스트 저장 (serial 변환 방지)
          );
          const 국세 = Math.floor((금액 * 0.03) / 10) * 10;
          const 지방 = Math.floor((금액 * 0.003) / 10) * 10;
          return ok(
            `✅ 인건비 지급 기록: ${name} ${won(금액)} (원천세 ${won(
              국세 + 지방
            )} → 실지급 ${won(금액 - 국세 - 지방)})${선금 ? " · 선금" : ""}.`
          );
        } catch (e) {
          return fail(`추가 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 공통경비 ───────────────────────────────────────────────────
    server.registerTool(
      "add_expense",
      {
        title: "공통경비 기록",
        description:
          "판관비/공통경비 지출 기록(common_expenses). 구분(예: 구독비·회식비·통신비 등)과 금액 필수.",
        inputSchema: {
          구분: z.string().describe("경비 구분(예: 구독비, 간식/회식비, 통신비)"),
          금액: z.coerce.number().positive().describe("금액(원)"),
          항목: z.string().optional().describe("세부 항목/내용"),
          날짜: z.string().optional().describe("지출일 YYYY-MM-DD (기본: 오늘)"),
        },
      },
      async ({ 구분, 금액, 항목, 날짜 }) => {
        try {
          await appendRows("common_expenses", [
            {
              지출일: 날짜 || today(),
              구분,
              항목: 항목 || "",
              금액,
            },
          ]);
          return ok(`✅ 공통경비 기록: [${구분}] ${항목 || ""} ${won(금액)}.`);
        } catch (e) {
          return fail(`추가 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 프로젝트 지출(경비/용역비/대표인출) ────────────────────────
    server.registerTool(
      "add_project_cost",
      {
        title: "프로젝트 지출 기록",
        description:
          "특정 프로젝트에 경비/외주 용역비/대표인출을 기록(project_costs). 세금계산서 매입·영수증을 해당 프로젝트 원가로 넣을 때 사용. 프로젝트명은 list_projects 의 정확한 이름.",
        inputSchema: {
          프로젝트: z.string().describe("연결 프로젝트명(정확히 일치)"),
          금액: z.coerce.number().positive().describe("금액(원)"),
          구분: z
            .enum(["경비", "용역비", "대표인출"])
            .optional()
            .describe("기본: 경비"),
          내용: z.string().optional().describe("내용/품목"),
          날짜: z.string().optional().describe("지출일 YYYY-MM-DD (기본: 오늘)"),
          파트너: z.string().optional().describe("거래처/지급처"),
        },
      },
      async ({ 프로젝트, 금액, 구분, 내용, 날짜, 파트너 }) => {
        try {
          const l = await loadLedger();
          if (!l.projects.some((p) => p["프로젝트명(내부)"] === 프로젝트.trim())) {
            const cand = l.projects
              .map((x) => x["프로젝트명(내부)"])
              .filter((n) => n && n.includes(프로젝트.trim()))
              .slice(0, 5);
            return fail(
              `'${프로젝트}' 프로젝트 없음.${cand.length ? ` 비슷한 것: ${cand.join(", ")}` : " list_projects 로 확인."}`
            );
          }
          await appendRows(
            "project_costs",
            [
              {
                프로젝트: 프로젝트.trim(),
                구분: 구분 || "경비",
                지출일: 날짜 || today(),
                내용: 내용 || "",
                금액,
                파트너: 파트너 || "",
                지급여부: "지급 완료",
                선금여부: "",
              },
            ],
            true // 날짜 텍스트 저장 (serial 변환 방지)
          );
          return ok(
            `✅ 프로젝트 지출 기록: [${프로젝트}] ${구분 || "경비"} ${내용 || ""} ${won(금액)}.`
          );
        } catch (e) {
          return fail(`추가 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 프로젝트 생성 ──────────────────────────────────────────────
    server.registerTool(
      "add_project",
      {
        title: "프로젝트 생성",
        description:
          "새 프로젝트를 만듦(projects). 부가세 미지정 시 공급가의 10%, 계약합계는 공급가+부가세로 자동. 나중에 rename_project 로 세금계산서 내역명과 일치시킬 수 있음.",
        inputSchema: {
          이름: z.string().describe("프로젝트명(내부, 임의로 지어도 됨)"),
          공급가: z.coerce.number().nonnegative().describe("공급가(부가세 제외, 원)"),
          클라이언트: z.string().optional().describe("클라이언트/거래처"),
          부가세: z.coerce.number().optional().describe("부가세(미지정 시 공급가의 10%)"),
          납품일: z.string().optional().describe("납품일 YYYY-MM-DD"),
          상태: z.string().optional().describe("기본: 작업중"),
        },
      },
      async ({ 이름, 공급가, 클라이언트, 부가세, 납품일, 상태 }) => {
        try {
          const l = await loadLedger();
          if (l.projects.some((p) => p["프로젝트명(내부)"] === 이름.trim())) {
            return fail(`'${이름}' 프로젝트가 이미 있습니다.`);
          }
          const vat = 부가세 != null ? 부가세 : Math.round(공급가 * 0.1);
          await appendRows("projects", [
            {
              "프로젝트명(내부)": 이름.trim(),
              클라이언트: 클라이언트 || "",
              납품일: 납품일 || "",
              상태: 상태 || "작업중",
              공급가,
              부가세: vat,
              계약합계: 공급가 + vat,
              정산상태: "작업중",
              계산서매핑: "",
            },
          ]);
          return ok(
            `✅ 프로젝트 생성: ${이름} (공급가 ${won(공급가)} + 부가세 ${won(vat)} = ${won(공급가 + vat)}).`
          );
        } catch (e) {
          return fail(`생성 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 세금계산서 기록 ────────────────────────────────────────────
    server.registerTool(
      "add_tax_invoice",
      {
        title: "세금계산서 기록",
        description:
          "발행/수취한 세금계산서를 기록(tax_invoices). 매출=우리가 발행, 매입=받은 것. 세액 미지정 시 공급가의 10%. 프로젝트매핑에 연결 프로젝트명을 넣으면 프로젝트와 연결됨.",
        inputSchema: {
          구분: z.enum(["매출", "매입"]).describe("매출(발행) 또는 매입(수취)"),
          거래처: z.string().describe("거래처명"),
          공급가: z.coerce.number().describe("공급가(원)"),
          세액: z.coerce.number().optional().describe("세액(미지정 시 공급가의 10%)"),
          작성일: z.string().optional().describe("작성일 YYYY-MM-DD (기본: 오늘)"),
          계산서품명: z.string().optional().describe("품목/내역명"),
          프로젝트매핑: z.string().optional().describe("연결 프로젝트명(선택)"),
        },
      },
      async ({ 구분, 거래처, 공급가, 세액, 작성일, 계산서품명, 프로젝트매핑 }) => {
        try {
          const vat = 세액 != null ? 세액 : Math.round(공급가 * 0.1);
          await appendRows("tax_invoices", [
            {
              구분,
              작성일: 작성일 || today(),
              승인번호: "",
              거래처,
              공급가,
              세액: vat,
              합계: 공급가 + vat,
              계산서품명: 계산서품명 || "",
              종류: "",
              프로젝트매핑: 프로젝트매핑 || "",
            },
          ]);
          return ok(
            `✅ 세금계산서(${구분}) 기록: ${거래처} ${계산서품명 || ""} 공급가 ${won(공급가)} + 세액 ${won(vat)}.`
          );
        } catch (e) {
          return fail(`추가 실패: ${(e as Error).message}`);
        }
      }
    );

    // ── 프로젝트명 변경 (연결 cascade) ─────────────────────────────
    server.registerTool(
      "rename_project",
      {
        title: "프로젝트명 변경(연결 유지)",
        description:
          "프로젝트 이름을 바꾸면서 연결된 인건비·앤드원·세금계산서(project_costs·andone·tax_invoices)의 프로젝트명을 한 번에 같이 변경. 임의로 지은 이름을 세금계산서 내역명과 일치시킬 때 사용. 연결이 끊기지 않음.",
        inputSchema: {
          기존이름: z.string().describe("현재 프로젝트명(정확히 일치)"),
          새이름: z.string().describe("바꿀 이름(예: 세금계산서 내역명)"),
        },
      },
      async ({ 기존이름, 새이름 }) => {
        try {
          const l = await loadLedger();
          if (!l.projects.some((p) => p["프로젝트명(내부)"] === 기존이름.trim())) {
            const cand = l.projects
              .map((x) => x["프로젝트명(내부)"])
              .filter((n) => n && n.includes(기존이름.trim()))
              .slice(0, 5);
            return fail(
              `'${기존이름}' 프로젝트 없음.${cand.length ? ` 비슷한 것: ${cand.join(", ")}` : " list_projects 로 확인."}`
            );
          }
          if (l.projects.some((p) => p["프로젝트명(내부)"] === 새이름.trim())) {
            return fail(`'${새이름}' 이름이 이미 있습니다. 다른 이름을 쓰세요.`);
          }
          const r = await renameProject(기존이름.trim(), 새이름.trim());
          return ok(
            `✅ '${기존이름}' → '${새이름}' 변경 완료. 연결 반영: 인건비/지출 ${r.costs}건, 앤드원 ${r.andone}건, 세금계산서 ${r.invoices}건.`
          );
        } catch (e) {
          return fail(`변경 실패: ${(e as Error).message}`);
        }
      }
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
);

// ── 토큰 인증 래퍼 ────────────────────────────────────────────────
// 헤더(x-api-key / Bearer) 또는 URL 쿼리(?key=…) 로 인증.
// 쿼리 방식은 헤더 인증(베타)이 안 열린 클라이언트에서 'URL만 붙여넣기'로 연결 가능.
function authorize(req: Request): boolean {
  const token = process.env.MCP_TOKEN;
  if (!token) return false; // 토큰 미설정 시 전부 차단(안전)
  const xkey = req.headers.get("x-api-key");
  const bearer = (req.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    ""
  );
  let qkey: string | null = null;
  try {
    qkey = new URL(req.url).searchParams.get("key");
  } catch {
    /* URL 파싱 실패 무시 */
  }
  return xkey === token || bearer === token || qkey === token;
}

async function guarded(req: Request): Promise<Response> {
  if (!authorize(req)) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: 401, message: "unauthorized" }, id: null }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
