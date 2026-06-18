"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import MoneyInput from "./MoneyInput";

const 구분옵션 = ["용역비", "경비", "대표인출"];
const 지급옵션 = ["지급 완료", "일부미지급", "미지급"];

export default function CostForm({
  project,
  partners,
}: {
  project: string;
  partners: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [c, setC] = useState({
    구분: "용역비",
    내용: "",
    금액: "",
    파트너: "",
    지출일: "",
    지급여부: "지급 완료",
    선금여부: false,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c.금액) {
      setErr("금액을 입력하세요.");
      return;
    }
    setSaving(true);
    setErr("");
    const res = await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        cost: {
          프로젝트: project,
          구분: c.구분,
          내용: c.내용,
          금액: Number(c.금액),
          파트너: c.파트너,
          지출일: c.지출일,
          지급여부: c.지급여부,
          선금여부: c.선금여부 ? "선금" : "",
        },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setC({
        구분: "용역비",
        내용: "",
        금액: "",
        파트너: "",
        지출일: "",
        지급여부: "지급 완료",
        선금여부: false,
      });
      setOpen(false);
      router.refresh();
    } else {
      setErr(json.error || "저장 실패");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 py-2.5 text-sm font-semibold active:bg-indigo-50"
      >
        <Plus size={16} /> 지출 추가
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3"
    >
      <datalist id="partners-list">
        {partners.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">지출 추가</span>
        <button type="button" onClick={() => setOpen(false)}>
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="flex gap-1.5">
        {구분옵션.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setC((p) => ({ ...p, 구분: g }))}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
              c.구분 === g
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <input
        value={c.내용}
        onChange={(e) => setC((p) => ({ ...p, 내용: e.target.value }))}
        placeholder="내용 (예: 인건비, 교통비)"
        className="cinp"
      />

      <div className="grid grid-cols-2 gap-2">
        <MoneyInput
          value={Number(c.금액) || 0}
          onChange={(n) => setC((p) => ({ ...p, 금액: n ? String(n) : "" }))}
          placeholder="금액"
          className="cinp"
        />
        <input
          list="partners-list"
          value={c.파트너}
          onChange={(e) => setC((p) => ({ ...p, 파트너: e.target.value }))}
          placeholder="파트너 (외주)"
          className="cinp"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={c.지출일}
          onChange={(e) => setC((p) => ({ ...p, 지출일: e.target.value }))}
          className="cinp"
        />
        <select
          value={c.지급여부}
          onChange={(e) => setC((p) => ({ ...p, 지급여부: e.target.value }))}
          className="cinp"
        >
          {지급옵션.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={c.선금여부}
          onChange={(e) => setC((p) => ({ ...p, 선금여부: e.target.checked }))}
          className="h-4 w-4 rounded"
        />
        선금통장에서 지급 (선금)
      </label>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <button
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-semibold disabled:opacity-50"
      >
        {saving ? "저장 중…" : "추가"}
      </button>

      <style>{`.cinp{width:100%;border-radius:0.625rem;border:1px solid #e2e8f0;background:#fff;padding:0.5rem 0.75rem;font-size:0.9rem}.cinp:focus{outline:none;box-shadow:0 0 0 2px #6366f1}`}</style>
    </form>
  );
}
