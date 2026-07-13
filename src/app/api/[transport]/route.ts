import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { loadLedger, loadAndone } from "@/lib/data";
import { appendRows, updateRow, deleteRowByMatch } from "@/lib/write";
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
          const 청구 = entries.filter((e) => e.구분 === "청구");
          const 수령 = entries.filter((e) => e.구분 === "수령");
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
          금액: z.number().positive().describe("받은 금액(원)"),
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
          금액: z.number().describe("삭제할 항목의 금액"),
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
          금액: z.number().positive().describe("지급총액(세전, 원)"),
          날짜: z.string().optional().describe("지급일 YYYY-MM-DD (기본: 오늘)"),
          프로젝트: z.string().optional().describe("연결 프로젝트(기본: 인건비)"),
          선금: z.boolean().optional().describe("선금통장 선지급 여부"),
          주민번호: z.string().optional().describe("주민번호(지급명세서용, 선택)"),
        },
      },
      async ({ 수령인, 금액, 날짜, 프로젝트, 선금, 주민번호 }) => {
        try {
          const name = 수령인.trim();
          if (주민번호) await upsertFreelancer(name, String(주민번호));
          await appendRows("project_costs", [
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
          ]);
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
          금액: z.number().positive().describe("금액(원)"),
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
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
);

// ── 토큰 인증 래퍼 ────────────────────────────────────────────────
function authorize(req: Request): boolean {
  const token = process.env.MCP_TOKEN;
  if (!token) return false; // 토큰 미설정 시 전부 차단(안전)
  const xkey = req.headers.get("x-api-key");
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "");
  return xkey === token || bearer === token;
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
