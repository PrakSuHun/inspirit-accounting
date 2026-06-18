import { loadLedger, rollupProjects } from "@/lib/data";
import { AppHeader } from "@/components/ui";
import ProjectList from "@/components/ProjectList";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export type ProjectListItem = {
  idx: number;
  name: string;
  client: string;
  date: string;
  status: string;
  settle: string;
  supply: number;
  margin: number;
  marginRate: number;
  type: "중개" | "자체제작";
};

export default function ProjectsPage() {
  const ledger = loadLedger();
  const rolls = rollupProjects(ledger);
  const items: ProjectListItem[] = rolls.map((r, idx) => ({
    idx,
    name: r.project["프로젝트명(내부)"],
    client: r.project.클라이언트,
    date: r.project.납품일,
    status: r.project.상태,
    settle: r.project.정산상태,
    supply: r.project.공급가,
    margin: r.마진_경영,
    marginRate: r.마진율_경영,
    type: r.유형,
  }));

  return (
    <main>
      <AppHeader
        title="프로젝트"
        subtitle={`외주 ${items.length}건`}
        right={
          <Link
            href="/projects/new"
            className="flex items-center gap-1 rounded-full bg-indigo-600 text-white text-sm font-semibold px-3.5 py-2 active:scale-95 transition"
          >
            <Plus size={16} /> 추가
          </Link>
        }
      />
      <ProjectList items={items} />
    </main>
  );
}
