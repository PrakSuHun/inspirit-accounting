import { loadLedger } from "@/lib/data";
import ProjectForm from "@/components/ProjectForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  const ledger = loadLedger();
  const clients = ledger.clients.map((c) => c.거래처명).filter(Boolean);

  return (
    <main>
      <header className="px-5 pt-6 pb-3">
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-slate-400 mb-2"
        >
          <ChevronLeft size={16} /> 프로젝트
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">새 프로젝트</h1>
      </header>
      <ProjectForm mode="create" clients={clients} />
    </main>
  );
}
