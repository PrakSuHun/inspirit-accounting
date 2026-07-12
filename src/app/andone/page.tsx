import { loadLedger, loadAndone } from "@/lib/data";
import { AppHeader } from "@/components/ui";
import Andone from "@/components/Andone";

export const dynamic = "force-dynamic";

export default async function AndonePage() {
  const [ledger, entries] = await Promise.all([loadLedger(), loadAndone()]);
  const projects = ledger.projects.map((p) => p["프로젝트명(내부)"]);
  // 이미 쓴 경로업체 목록 (자동완성용)
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
