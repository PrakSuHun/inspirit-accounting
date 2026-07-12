"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { won } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";
import { Plus, X, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import MoneyInput from "./MoneyInput";
import type { AndoneEntry } from "@/lib/types";

export default function Andone({
  entries,
  projects,
  vendors,
}: {
  entries: AndoneEntry[];
  projects: string[];
  vendors: string[];
}) {
  const router = useRouter();
  const [delKey, setDelKey] = useState<string | null>(null);

  const 청구목록 = useMemo(
    () =>
      entries
        .filter((e) => e.구분 === "청구")
        .sort((a, b) => String(b.날짜).localeCompare(String(a.날짜))),
    [entries]
  );
  const 수령목록 = useMemo(
    () =>
      entries
        .filter((e) => e.구분 === "수령")
        .sort((a, b) => String(b.날짜).localeCompare(String(a.날짜))),
    [entries]
  );

  const 받을총액 = 청구목록.reduce((s, e) => s + e.금액, 0);
  const 받은총액 = 수령목록.reduce((s, e) => s + e.금액, 0);
  const 미수 = 받을총액 - 받은총액;

  async function del(e: AndoneEntry) {
    const label = e.구분 === "수령" ? "받은 돈" : "받아야 할 돈";
    if (!confirm(`${label} "${e.내용 || e.경로업체 || e.날짜} ${won(e.금액)}" 삭제할까요?`))
      return;
    const key = e.구분 + e.날짜 + e.내용 + e.금액 + e.경로업체;
    setDelKey(key);
    await fetch("/api/andone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        match: {
          날짜: e.날짜,
          구분: e.구분,
          내용: e.내용,
          금액: e.금액,
          경로업체: e.경로업체,
        },
      }),
    });
    setDelKey(null);
    router.refresh();
  }

  return (
    <div>
      {/* 미수 요약 카드 */}
      <div className="px-5">
        <div
          className={`rounded-3xl bg-gradient-to-br ${
            미수 > 0
              ? "from-rose-500 to-pink-600"
              : "from-emerald-500 to-teal-600"
          } text-white p-5 shadow-md`}
        >
          <div className="text-sm opacity-90">
            {미수 > 0 ? "앤드원에 청구할 미수" : "정산 완료"}
          </div>
          <div className="text-3xl font-bold mt-1.5">{won(미수)}</div>
          <div className="flex gap-x-6 gap-y-2 mt-3 text-sm">
            <div>
              <div className="opacity-75 text-xs">받아야 할 돈</div>
              <div className="font-semibold">{won(받을총액)}</div>
            </div>
            <div>
              <div className="opacity-75 text-xs">받은 돈</div>
              <div className="font-semibold">{won(받은총액)}</div>
            </div>
          </div>
          <div className="text-[11px] mt-3 opacity-85 leading-relaxed">
            앤드원에서 받아야 할 금액 중, 다른 업체를 통해 받은 돈을 뺀 차액을 앤드원에
            청구하세요.
          </div>
        </div>
      </div>

      {/* 입력 */}
      <div className="px-5 mt-4">
        <AddEntry projects={projects} vendors={vendors} />
      </div>

      {/* 받아야 할 돈 (청구) */}
      <SectionTitle>받아야 할 돈 (앤드원 청구)</SectionTitle>
      <div className="px-5 space-y-2">
        {청구목록.map((e, i) => (
          <Row
            key={i}
            e={e}
            tone="claim"
            onDelete={() => del(e)}
            deleting={delKey === e.구분 + e.날짜 + e.내용 + e.금액 + e.경로업체}
          />
        ))}
        {청구목록.length === 0 && <Empty text="받아야 할 돈이 아직 없습니다." />}
      </div>

      {/* 받은 돈 (수령) */}
      <SectionTitle>받은 돈 (다른 업체 통해)</SectionTitle>
      <div className="px-5 space-y-2 pb-4">
        {수령목록.map((e, i) => (
          <Row
            key={i}
            e={e}
            tone="receive"
            onDelete={() => del(e)}
            deleting={delKey === e.구분 + e.날짜 + e.내용 + e.금액 + e.경로업체}
          />
        ))}
        {수령목록.length === 0 && <Empty text="받은 돈이 아직 없습니다." />}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card className="p-6">
      <p className="text-center text-sm text-slate-400">{text}</p>
    </Card>
  );
}

function Row({
  e,
  tone,
  onDelete,
  deleting,
}: {
  e: AndoneEntry;
  tone: "claim" | "receive";
  onDelete: () => void;
  deleting: boolean;
}) {
  const claim = tone === "claim";
  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${
              claim ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {claim ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">
              {e.내용 || (claim ? "앤드원 청구" : "수령")}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {e.날짜 || "날짜 없음"}
              {!claim && e.경로업체 && ` · ${e.경로업체} 통해`}
              {e.프로젝트 && ` · ${e.프로젝트}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-sm font-bold ${
              claim ? "text-slate-900" : "text-emerald-600"
            }`}
          >
            {claim ? "" : "−"}
            {won(e.금액)}
          </span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-slate-300 hover:text-rose-500 disabled:opacity-40 p-1"
            title="삭제"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </Card>
  );
}

function AddEntry({
  projects,
  vendors,
}: {
  projects: string[];
  vendors: string[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    구분: "청구" as "청구" | "수령",
    날짜: today,
    금액: "",
    내용: "",
    경로업체: "",
    프로젝트: "",
  });

  function reset() {
    setF({
      구분: f.구분,
      날짜: today,
      금액: "",
      내용: "",
      경로업체: "",
      프로젝트: "",
    });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.금액 || !Number(f.금액)) {
      setErr("금액을 입력하세요.");
      return;
    }
    setSaving(true);
    setErr("");
    const res = await fetch("/api/andone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", entry: f }),
    });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setSaving(false);
    if (json.ok) {
      reset();
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
        <Plus size={16} /> 정산 내역 추가
      </button>
    );

  const 수령 = f.구분 === "수령";
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">정산 내역 추가</span>
        <button type="button" onClick={() => setOpen(false)}>
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      {/* 구분 토글 */}
      <div className="grid grid-cols-2 gap-2">
        {(["청구", "수령"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setF({ ...f, 구분: g })}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              f.구분 === g
                ? g === "청구"
                  ? "bg-rose-500 text-white"
                  : "bg-emerald-500 text-white"
                : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            {g === "청구" ? "받아야 할 돈" : "받은 돈"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={f.날짜}
          onChange={(e) => setF({ ...f, 날짜: e.target.value })}
          className="pinp"
        />
        <MoneyInput
          value={Number(f.금액) || 0}
          onChange={(n) => setF({ ...f, 금액: n ? String(n) : "" })}
          placeholder="금액"
          className="pinp"
        />
      </div>

      <input
        value={f.내용}
        onChange={(e) => setF({ ...f, 내용: e.target.value })}
        placeholder={수령 ? "내용 (무슨 건인지)" : "내용 (무슨 건인지)"}
        className="pinp w-full"
      />

      {수령 && (
        <Typeahead
          value={f.경로업체}
          onChange={(v) => setF({ ...f, 경로업체: v })}
          options={vendors}
          placeholder="어느 업체 통해 받았나요?"
        />
      )}

      <Typeahead
        value={f.프로젝트}
        onChange={(v) => setF({ ...f, 프로젝트: v })}
        options={[...projects].reverse()}
        placeholder="연결 프로젝트(선택)"
      />

      {err && <p className="text-sm text-red-500">{err}</p>}
      <button
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-semibold disabled:opacity-50"
      >
        {saving ? "저장 중…" : "기록 추가"}
      </button>
    </form>
  );
}

// 모바일 datalist 대체 자동완성 (Payroll 과 동일 패턴)
function Typeahead({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [focus, setFocus] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!focus) return [];
    const base = q
      ? options.filter((o) => o.toLowerCase().includes(q) && o !== value)
      : options;
    return base.slice(0, 8);
  }, [focus, q, options, value]);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="pinp w-full"
      />
      {matches.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o);
                  setFocus(false);
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-slate-700 active:bg-indigo-50 hover:bg-indigo-50"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
