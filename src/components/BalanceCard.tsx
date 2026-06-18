"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { won } from "@/lib/format";
import { Pencil, X } from "lucide-react";
import MoneyInput from "./MoneyInput";

export default function BalanceCard({
  합계,
  갱신일,
}: {
  합계: number;
  갱신일: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState(합계);

  async function save() {
    setSaving(true);
    await fetch("/api/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 잔고: v }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 shadow-md">
      <div className="flex items-start justify-between">
        <div className="text-sm/none opacity-90">순이익 (모임통장 잔고)</div>
        <button onClick={() => setOpen((x) => !x)} className="opacity-80">
          {open ? <X size={18} /> : <Pencil size={15} />}
        </button>
      </div>

      {!open ? (
        <>
          <div className="text-3xl font-bold mt-2 tracking-tight">
            {won(합계)}
          </div>
          <div className="text-xs opacity-80 mt-1">
            {갱신일 ? `마지막 업데이트 ${갱신일}` : "통장에 실제 있는 돈"}
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="text-xs opacity-85">
            카카오뱅크 모임통장 잔고 (통장 + 세이프박스 합쳐서)
          </div>
          <MoneyInput
            value={v}
            onChange={setV}
            className="w-full rounded-xl px-3 py-2.5 text-slate-800 text-lg font-semibold"
          />
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-white/25 backdrop-blur py-2.5 font-semibold disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
    </div>
  );
}
