import { loadLedger, rollupProjects } from "@/lib/data";
import { won, pct } from "@/lib/format";
import { Card } from "@/components/ui";
import ProjectWorkflow from "@/components/ProjectWorkflow";
import CostList from "@/components/CostList";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ idx: string }>;
}) {
  const { idx } = await params;
  const i = Number(idx);
  const ledger = await loadLedger();
  const rolls = rollupProjects(ledger);
  const r = rolls[i];
  if (!r) notFound();

  const p = r.project;
  const partners = ledger.partners.map((pt) => pt.이름).filter(Boolean);

  return (
    <main>
      <header className="px-5 pt-6 pb-2">
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-slate-400 mb-2"
        >
          <ChevronLeft size={16} /> 프로젝트
        </Link>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900">
            {p["프로젝트명(내부)"]}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                r.유형 === "중개"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {r.유형}
            </span>
            <Link
              href={`/projects/${i}/edit`}
              className="flex items-center gap-1 text-xs text-indigo-600 font-medium"
            >
              <Pencil size={13} /> 수정
            </Link>
          </div>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">
          {p.클라이언트} · {p.납품일 || "납품일 미정"}
        </p>
      </header>

      <div className="px-5 space-y-3">
        {/* 정산 요약 */}
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-slate-400">공급가</span>
            <span className="text-right font-semibold">{won(p.공급가)}</span>
            <span className="text-slate-400">부가세</span>
            <span className="text-right">{won(p.부가세)}</span>
            <span className="text-slate-400">계약합계</span>
            <span className="text-right font-semibold">{won(p.계약합계)}</span>
            <div className="col-span-2 border-t border-slate-100 my-1" />
            <span className="text-slate-400">외주 용역비(타인)</span>
            <span className="text-right text-rose-500">
              −{won(r.외주용역비)}
            </span>
            <span className="text-slate-400">직접경비</span>
            <span className="text-right text-rose-500">−{won(r.경비)}</span>
            <span className="text-slate-400">대표 인출</span>
            <span className="text-right text-slate-500">−{won(r.대표인출)}</span>
            <div className="col-span-2 border-t border-slate-100 my-1" />
            <span className="font-semibold text-slate-700">
              순이익(경영용)
            </span>
            <span
              className={`text-right font-bold ${
                r.마진_경영 >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {won(r.마진_경영)} ({pct(r.마진율_경영)})
            </span>
          </div>
        </Card>

        {/* 워크플로우 체크박스 (시트에 write) */}
        <ProjectWorkflow
          idx={i}
          name={p["프로젝트명(내부)"]}
          status={p.상태}
          settle={p.정산상태}
        />

        {/* 지출 내역 (추가/삭제 가능) */}
        <CostList
          project={p["프로젝트명(내부)"]}
          partners={partners}
          costs={r.costs.map((c) => ({
            구분: c.구분,
            지출일: c.지출일,
            내용: c.내용,
            금액: c.금액,
            파트너: c.파트너,
            지급여부: c.지급여부,
            선금여부: c.선금여부,
          }))}
        />
      </div>
    </main>
  );
}
