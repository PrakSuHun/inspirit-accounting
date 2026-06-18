import { loadLedger } from "@/lib/data";
import ProjectForm from "@/components/ProjectForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ idx: string }>;
}) {
  const { idx } = await params;
  const ledger = loadLedger();
  const p = ledger.projects[Number(idx)];
  if (!p) notFound();
  const clients = ledger.clients.map((c) => c.거래처명).filter(Boolean);

  return (
    <main>
      <header className="px-5 pt-6 pb-3">
        <Link
          href={`/projects/${idx}`}
          className="inline-flex items-center text-sm text-slate-400 mb-2"
        >
          <ChevronLeft size={16} /> 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">프로젝트 수정</h1>
      </header>
      <ProjectForm
        mode="edit"
        clients={clients}
        initial={{
          "프로젝트명(내부)": p["프로젝트명(내부)"],
          클라이언트: p.클라이언트,
          납품일: p.납품일,
          상태: p.상태,
          공급가: p.공급가,
          부가세: p.부가세,
          정산상태: p.정산상태,
        }}
      />
    </main>
  );
}
