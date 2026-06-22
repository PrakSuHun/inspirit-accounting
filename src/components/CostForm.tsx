"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import MoneyInput from "./MoneyInput";
import { won } from "@/lib/format";

const 구분옵션 = ["용역비", "경비", "대표인출"];
const 지급옵션 = ["지급 완료", "일부미지급", "미지급"];
const 경비분류 = ["교통비", "식대", "장비", "소모품", "숙박", "임차/관리", "기타"];

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
    분류: "교통비", // 경비 분류(드롭다운)
    내용: "",
    금액: "",
    파트너: "",
    지출일: "",
    지급여부: "지급 완료",
    선금여부: false,
  });

  const reset = {
    구분: "용역비",
    분류: "교통비",
    내용: "",
    금액: "",
    파트너: "",
    지출일: "",
    지급여부: "지급 완료",
    선금여부: false,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c.금액) {
      setErr("금액을 입력하세요.");
      return;
    }
    setSaving(true);
    setErr("");
    // 경비는 "분류 · 메모"로 합쳐 저장 (분류가 앞)
    const 내용 =
      c.구분 === "경비"
        ? c.분류 + (c.내용 ? ` · ${c.내용}` : "")
        : c.내용;
    const res = await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        cost: {
          프로젝트: project,
          구분: c.구분,
          내용,
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
      setC(reset);
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
            onClick={() =>
              setC((p) => ({
                ...p,
                구분: g,
                // 대표인출=박수훈 고정, 경비=파트너 없음, 용역비=직접 선택
                파트너: g === "대표인출" ? "박수훈" : g === "경비" ? "" : p.파트너,
              }))
            }
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

      {/* 용역비: 프리랜서 수령인 (원천세 자동) */}
      {c.구분 === "용역비" && (
        <input
          list="partners-list"
          value={c.파트너}
          onChange={(e) => setC((p) => ({ ...p, 파트너: e.target.value }))}
          placeholder="수령인 (프리랜서/외주)"
          className="cinp"
        />
      )}
      {/* 대표인출: 박수훈 고정 안내 */}
      {c.구분 === "대표인출" && (
        <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-500">
          대표(박수훈) 인출 — 회사 돈을 대표가 가져가는 것
        </div>
      )}

      {c.구분 === "경비" ? (
        <>
          <select
            value={c.분류}
            onChange={(e) => setC((p) => ({ ...p, 분류: e.target.value }))}
            className="cinp"
          >
            {경비분류.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <input
            value={c.내용}
            onChange={(e) => setC((p) => ({ ...p, 내용: e.target.value }))}
            placeholder="메모 (선택, 예: 강남 미팅 택시)"
            className="cinp"
          />
        </>
      ) : (
        <input
          value={c.내용}
          onChange={(e) => setC((p) => ({ ...p, 내용: e.target.value }))}
          placeholder={
            c.구분 === "용역비" ? "내용 (예: 영상 편집)" : "메모 (선택)"
          }
          className="cinp"
        />
      )}

      <MoneyInput
        value={Number(c.금액) || 0}
        onChange={(n) => setC((p) => ({ ...p, 금액: n ? String(n) : "" }))}
        placeholder="금액"
        className="cinp"
      />

      {/* 용역비면 원천세 미리보기 */}
      {c.구분 === "용역비" && Number(c.금액) > 0 && (
        <p className="text-[11px] text-slate-500 -mt-1">
          원천세 3.3% {won(Math.floor((Number(c.금액) * 0.033) / 10) * 10)} → 실지급{" "}
          {won(
            Number(c.금액) - Math.floor((Number(c.금액) * 0.033) / 10) * 10
          )}
        </p>
      )}

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
