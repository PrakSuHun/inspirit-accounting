"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// 프로젝트 워크플로우: 상태(진행/완료) + 정산상태(입금 완료)
export default function ProjectWorkflow({
  name,
  status,
  settle,
}: {
  idx: number;
  name: string;
  status: string;
  settle: string;
}) {
  const [done, setDone] = useState(status.includes("완료"));
  const [paid, setPaid] = useState(settle.includes("완료"));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(patch: { 상태?: string; 정산상태?: string }) {
    setSaving(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, patch }),
    });
    setSaving(false);
    router.refresh();
  }

  const steps = [
    {
      label: "납품 완료",
      checked: done,
      toggle: () => {
        const v = !done;
        setDone(v);
        save({ 상태: v ? "완료" : "진행" });
      },
    },
    {
      label: "입금 완료",
      checked: paid,
      toggle: () => {
        const v = !paid;
        setPaid(v);
        save({ 정산상태: v ? "입금 완료" : "미입금" });
      },
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-600">
          진행 체크리스트
        </span>
        {saving && <span className="text-[11px] text-indigo-400">저장 중…</span>}
      </div>
      <div className="space-y-1">
        {steps.map((s) => (
          <button
            key={s.label}
            onClick={s.toggle}
            disabled={saving}
            className="w-full flex items-center gap-3 py-2.5 disabled:opacity-60"
          >
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition ${
                s.checked
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-slate-300 text-transparent"
              }`}
            >
              <Check size={14} strokeWidth={3} />
            </span>
            <span
              className={`text-sm ${
                s.checked ? "text-slate-800 font-medium" : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
