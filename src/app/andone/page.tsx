import { loadLedger, loadAndone } from "@/lib/data";
import { AppHeader } from "@/components/ui";
import Andone from "@/components/Andone";

export const dynamic = "force-dynamic";

export default async function AndonePage() {
  const [ledger, entries] = await Promise.all([loadLedger(), loadAndone()]);
  // 세금계산서 발급한 건 = 프로젝트. 받아야 할 돈은 여기서 연결(금액·날짜 자동).
  const projects = ledger.projects
    .filter((p) => p["프로젝트명(내부)"])
    .map((p) => ({
      name: p["프로젝트명(내부)"],
      client: p.클라이언트,
      amount: p.계약합계 || p.공급가 + p.부가세, // 받을 총액(부가세 포함)
      date: p.납품일,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const vendors = [
    ...new Set(entries.map((e) => e.경로업체).filter(Boolean)),
  ];

  return (
    <main>
      <AppHeader title="앤드원 정산" subtitle="받을 돈 · 받은 돈 · 미수 차액" />
      <Andone entries={entries} projects={projects} vendors={vendors} />
    </main>
  );
}
