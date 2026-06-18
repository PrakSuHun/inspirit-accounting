"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { won, manwon } from "@/lib/format";
import { Card, StatCard, SectionTitle } from "@/components/ui";
import { Plus, X, Trash2 } from "lucide-react";
import MoneyInput from "./MoneyInput";
import type { ExpenseItem } from "@/app/expenses/page";

const 기본구분 = [
  "간식/회식비",
  "관리비",
  "구독비",
  "비품/장비",
  "임차료",
  "통신비",
  "광고선전비",
  "세금/공과금",
  "영업외수익",
  "영업외비용",
  "기타",
];

const is영업외 = (g: string) => g === "영업외수익" || g === "영업외비용";

export default function Expenses({
  items,
  categories,
}: {
  items: ExpenseItem[];
  categories: string[];
}) {
  const router = useRouter();
  const [year, setYear] = useState<"2025" | "2026">("2026");
  const [delKey, setDelKey] = useState<string | null>(null);

  const yearItems = useMemo(
    () => items.filter((i) => String(i.지출일).startsWith(year)),
    [items, year]
  );

  const 판관비 = yearItems
    .filter((i) => !is영업외(i.구분))
    .reduce((s, i) => s + i.금액, 0);
  const 영업외수익 = yearItems
    .filter((i) => i.구분 === "영업외수익")
    .reduce((s, i) => s + i.금액, 0);
  const 영업외비용 = yearItems
    .filter((i) => i.구분 === "영업외비용")
    .reduce((s, i) => s + i.금액, 0);

  // 월별 그룹 (최신순)
  const months = [
    ...new Set(yearItems.map((i) => String(i.지출일).slice(0, 7))),
  ].sort((a, b) => b.localeCompare(a));

  const allCats = [...new Set([...categories, ...기본구분])];

  async function del(e: ExpenseItem, key: string) {
    if (!confirm(`"${e.항목 || e.구분} ${won(e.금액)}" 삭제할까요?`)) return;
    setDelKey(key);
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        match: {
          지출일: e.지출일,
          구분: e.구분,
          항목: e.항목,
          금액: e.금액,
        },
      }),
    });
    setDelKey(null);
    router.refresh();
  }

  return (
    <div>
      {/* 연도 토글 */}
      <div className="px-5 flex gap-2">
        {(["2025", "2026"] as const).map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              year === y
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            {y}년
          </button>
        ))}
      </div>

      {/* 요약 */}
      <div className="px-5 mt-3 grid grid-cols-3 gap-3">
        <StatCard label={`${year} 판관비`} value={manwon(판관비)} accent="text-rose-600" />
        <StatCard label="영업외수익" value={manwon(영업외수익)} accent="text-emerald-600" />
        <StatCard label="영업외비용" value={manwon(영업외비용)} accent="text-slate-700" />
      </div>

      {/* 입력 */}
      <div className="px-5 mt-4">
        <AddExpense categories={allCats} />
      </div>

      {/* 월별 목록 */}
      <SectionTitle>지출 내역</SectionTitle>
      <div className="px-5 space-y-4 pb-4">
        {months.length === 0 && (
          <Card className="p-6">
            <p className="text-center text-sm text-slate-400">
              {year}년 공통경비 기록이 없습니다.
            </p>
          </Card>
        )}
        {months.map((ym) => {
          const list = yearItems.filter(
            (i) => String(i.지출일).slice(0, 7) === ym
          );
          const 합계 = list
            .filter((i) => !is영업외(i.구분))
            .reduce((s, i) => s + i.금액, 0);
          return (
            <div key={ym}>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-sm font-bold text-slate-700">{ym}</span>
                <span className="text-[11px] text-slate-400">
                  판관비 {won(합계)}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((e, i) => {
                  const key = `${ym}-${i}`;
                  return (
                    <Card key={key} className="p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {e.항목 || e.구분}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                is영업외(e.구분)
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {e.구분}
                            </span>{" "}
                            · {e.지출일}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div
                            className={`text-sm font-bold ${
                              e.구분 === "영업외수익"
                                ? "text-emerald-600"
                                : "text-slate-900"
                            }`}
                          >
                            {won(e.금액)}
                          </div>
                          <button
                            onClick={() => del(e, key)}
                            disabled={delKey === key}
                            className="text-slate-300 hover:text-rose-500 disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddExpense({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ 지출일: "", 구분: "", 항목: "", 금액: "" });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.구분 || !f.금액) {
      setErr("구분과 금액은 필수입니다.");
      return;
    }
    setSaving(true);
    setErr("");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", expense: f }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setF({ 지출일: "", 구분: "", 항목: "", 금액: "" });
      setOpen(false);
      router.refresh();
    } else setErr(json.error || "저장 실패");
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white py-3 text-sm font-semibold active:scale-[0.99]"
      >
        <Plus size={16} /> 공통경비 추가
      </button>
    );

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3"
    >
      <datalist id="cat-list">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          공통경비 추가
        </span>
        <button type="button" onClick={() => setOpen(false)}>
          <X size={18} className="text-slate-400" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={f.지출일}
          onChange={(e) => setF({ ...f, 지출일: e.target.value })}
          className="einp"
        />
        <input
          list="cat-list"
          value={f.구분}
          onChange={(e) => setF({ ...f, 구분: e.target.value })}
          placeholder="구분 (예: 구독비)"
          className="einp"
        />
      </div>
      <input
        value={f.항목}
        onChange={(e) => setF({ ...f, 항목: e.target.value })}
        placeholder="항목 (예: 어도비 구독)"
        className="einp"
      />
      <MoneyInput
        value={Number(f.금액) || 0}
        onChange={(n) => setF({ ...f, 금액: n ? String(n) : "" })}
        placeholder="금액"
        className="einp"
      />
      <p className="text-[11px] text-slate-400">
        ※ 영업외수익·영업외비용도 구분에서 선택하면 손익에 맞게 반영됩니다.
      </p>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <button
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-semibold disabled:opacity-50"
      >
        {saving ? "저장 중…" : "추가"}
      </button>
      <style>{`.einp{width:100%;border-radius:0.625rem;border:1px solid #e2e8f0;background:#fff;padding:0.5rem 0.75rem;font-size:0.9rem}.einp:focus{outline:none;box-shadow:0 0 0 2px #6366f1}`}</style>
    </form>
  );
}
