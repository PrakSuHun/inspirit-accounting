"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { won } from "@/lib/format";
import CostForm from "./CostForm";

export type CostRow = {
  구분: string;
  지출일: string;
  내용: string;
  금액: number;
  파트너: string;
  지급여부: string;
  선금여부: string;
};

export default function CostList({
  project,
  costs,
  partners,
}: {
  project: string;
  costs: CostRow[];
  partners: string[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);

  async function del(c: CostRow, i: number) {
    if (!confirm(`"${c.내용 || c.구분} ${won(c.금액)}" 지출을 삭제할까요?`)) return;
    setDeleting(i);
    await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        match: {
          프로젝트: project,
          지출일: c.지출일,
          내용: c.내용,
          금액: c.금액,
        },
      }),
    });
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-4">
      <div className="text-sm font-semibold text-slate-600 mb-2">
        지출 내역 ({costs.length})
      </div>
      <div className="space-y-2 mb-3">
        {costs.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0"
          >
            <div className="min-w-0">
              <div className="text-slate-700 truncate">
                {c.내용 || c.구분}
              </div>
              <div className="text-[11px] text-slate-400">
                {c.구분} · {c.파트너 || "—"} · {c.지출일}
                {c.선금여부 ? " · 선금" : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="text-slate-700">{won(c.금액)}</div>
                <div
                  className={`text-[10px] ${
                    c.지급여부.includes("완료")
                      ? "text-slate-400"
                      : "text-rose-500"
                  }`}
                >
                  {c.지급여부 || "미정"}
                </div>
              </div>
              <button
                onClick={() => del(c, i)}
                disabled={deleting === i}
                className="text-slate-300 hover:text-rose-500 disabled:opacity-40"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {costs.length === 0 && (
          <p className="text-sm text-slate-400 py-2">지출 내역 없음</p>
        )}
      </div>
      <CostForm project={project} partners={partners} />
    </div>
  );
}
