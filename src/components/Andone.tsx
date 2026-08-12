"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { won } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";
import { Plus, X, Trash2, ArrowUpRight, EyeOff, Eye } from "lucide-react";
import type { AndoneEntry } from "@/lib/types";

type ProjOpt = { name: string; client: string; amount: number; date: string };

export default function Andone({
  entries,
  projects,
  vendors,
}: {
  entries: AndoneEntry[];
  projects: ProjOpt[];
  vendors: string[];
}) {
  const router = useRouter();
  const [delKey, setDelKey] = useState<string | null>(null);
  const [exKey, setExKey] = useState<string | null>(null);

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

  // 이미 청구로 연결된 프로젝트 (중복 연결 방지)
  const claimedNames = useMemo(
    () => new Set(청구목록.map((e) => e.프로젝트).filter(Boolean)),
    [청구목록]
  );

  // 집계제외 표시된 건은 합계에서 뺌 (목록엔 남음)
  const 받을총액 = 청구목록
    .filter((e) => !e.집계제외)
    .reduce((s, e) => s + e.금액, 0);
  const 받은총액 = 수령목록
    .filter((e) => !e.집계제외)
    .reduce((s, e) => s + e.금액, 0);
  const 미수 = 받을총액 - 받은총액;
  const 제외건수 = entries.filter((e) => e.집계제외).length;

  const keyOf = (e: AndoneEntry) =>
    e.구분 + e.날짜 + e.내용 + e.금액 + e.경로업체;

  // 집계제외 토글 (삭제 없이 계산에서만 빼기/되돌리기)
  async function toggleExclude(e: AndoneEntry) {
    setExKey(keyOf(e));
    await fetch("/api/andone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "exclude",
        excluded: !e.집계제외,
        match: {
          날짜: e.날짜,
          구분: e.구분,
          내용: e.내용,
          금액: e.금액,
          경로업체: e.경로업체,
        },
      }),
    });
    setExKey(null);
    router.refresh();
  }

  // 삭제는 andone 시트에서만 — 프로젝트에는 영향 없음
  async function del(e: AndoneEntry) {
    const label = e.구분 === "수령" ? "받은 돈" : "받아야 할 돈";
    if (
      !confirm(
        `${label} "${e.내용 || e.경로업체 || e.날짜} ${won(
          e.금액
        )}" 을(를) 앤드원 정산에서 삭제할까요?\n(프로젝트 기록은 그대로 유지됩니다)`
      )
    )
      return;
    setDelKey(keyOf(e));
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
            세금계산서 발급한 프로젝트를 연결해 받을 돈을 잡고, 다른 업체를 통해 받은
            돈을 빼면 앤드원에 청구할 차액이 나옵니다.
            {제외건수 > 0 && (
              <span className="block mt-1 opacity-90">
                · 집계 제외 {제외건수}건은 합계에서 빠져 있어요.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 입력 */}
      <div className="px-5 mt-4">
        <AddEntry
          projects={projects}
          vendors={vendors}
          claimedNames={claimedNames}
        />
      </div>

      {/* 받아야 할 돈 (청구) */}
      <SectionTitle>받아야 할 돈 (세금계산서 발급 건)</SectionTitle>
      <div className="px-5 space-y-2">
        {청구목록.map((e) => (
          <Row
            key={keyOf(e)}
            e={e}
            tone="claim"
            onDelete={() => del(e)}
            deleting={delKey === keyOf(e)}
            onToggleExclude={() => toggleExclude(e)}
            toggling={exKey === keyOf(e)}
          />
        ))}
        {청구목록.length === 0 && (
          <Empty text="연결한 프로젝트가 아직 없습니다." />
        )}
      </div>

      {/* 받은 돈 (수령) */}
      <SectionTitle>받은 돈 (다른 업체 통해)</SectionTitle>
      <div className="px-5 space-y-2 pb-4">
        {수령목록.map((e) => (
          <Row
            key={keyOf(e)}
            e={e}
            tone="receive"
            onDelete={() => del(e)}
            deleting={delKey === keyOf(e)}
            onToggleExclude={() => toggleExclude(e)}
            toggling={exKey === keyOf(e)}
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
  onToggleExclude,
  toggling,
}: {
  e: AndoneEntry;
  tone: "claim" | "receive";
  onDelete: () => void;
  deleting: boolean;
  onToggleExclude: () => void;
  toggling: boolean;
}) {
  const claim = tone === "claim";
  const excluded = e.집계제외;
  const title = e.내용 || e.프로젝트 || (claim ? "앤드원 청구" : "수령");
  return (
    <Card className={`p-3.5 ${excluded ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <ArrowUpRight size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate flex items-center gap-1.5">
              <span className={excluded ? "line-through" : ""}>{title}</span>
              {excluded && (
                <span className="shrink-0 text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 py-0.5">
                  집계 제외
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {e.날짜 || "날짜 없음"}
              {!claim && e.경로업체 && ` · ${e.경로업체} 통해`}
              {e.프로젝트 && e.프로젝트 !== title && ` · ${e.프로젝트}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-sm font-bold text-slate-900 ${
              excluded ? "line-through" : ""
            }`}
          >
            {won(e.금액)}
          </span>
          <button
            onClick={onToggleExclude}
            disabled={toggling}
            className={`disabled:opacity-40 p-1 ${
              excluded
                ? "text-indigo-400 hover:text-indigo-600"
                : "text-slate-300 hover:text-slate-600"
            }`}
            title={excluded ? "집계에 다시 포함" : "이 건만 집계에서 제외"}
          >
            {excluded ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-slate-300 hover:text-rose-500 disabled:opacity-40 p-1"
            title="앤드원 정산에서만 삭제"
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
  claimedNames,
}: {
  projects: ProjOpt[];
  vendors: string[];
  claimedNames: Set<string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"청구" | "수령">("청구");

  // 청구·수령 공통: 프로젝트 연결 (금액·날짜 자동)
  const [claim, setClaim] = useState<ProjOpt | null>(null);
  // 수령: 어느 업체 통해 받았는지 (선택)
  const [via, setVia] = useState("");

  const availProjects = useMemo(
    () => projects.filter((p) => !claimedNames.has(p.name)),
    [projects, claimedNames]
  );

  function resetAndClose() {
    setClaim(null);
    setVia("");
    setErr("");
    setOpen(false);
  }

  async function post(entry: Record<string, string | number>) {
    setSaving(true);
    setErr("");
    const res = await fetch("/api/andone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", entry }),
    });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setSaving(false);
    if (json.ok) {
      resetAndClose();
      router.refresh();
    } else setErr(json.error || "저장 실패");
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!claim) {
      setErr("연결할 프로젝트를 선택하세요.");
      return;
    }
    post({
      날짜: claim.date,
      구분: mode,
      내용: claim.name,
      금액: claim.amount,
      경로업체: mode === "수령" ? via : "",
      프로젝트: claim.name,
    });
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

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">정산 내역 추가</span>
        <button type="button" onClick={resetAndClose}>
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      {/* 구분 토글 */}
      <div className="grid grid-cols-2 gap-2">
        {(["청구", "수령"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setMode(g);
              setErr("");
            }}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              mode === g
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

      <ProjectPicker
        options={mode === "청구" ? availProjects : projects}
        value={claim}
        onSelect={setClaim}
      />
      {mode === "청구" ? (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          세금계산서 발급한 프로젝트를 고르면 금액·납품일이 자동으로 들어갑니다.
          직접 입력할 필요 없어요.
        </p>
      ) : (
        <>
          <Typeahead
            value={via}
            onChange={setVia}
            options={vendors}
            placeholder="어느 업체 통해 받았나요? (선택)"
          />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            받은 프로젝트를 고르면 금액·날짜가 자동으로 들어갑니다. 직접 입력할
            필요 없어요.
          </p>
        </>
      )}

      {err && <p className="text-sm text-red-500">{err}</p>}
      <button
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-semibold disabled:opacity-50"
      >
        {saving ? "저장 중…" : "추가"}
      </button>
    </form>
  );
}

// 프로젝트 연결 선택기 (세금계산서 발급 건 → 금액·날짜 자동)
function ProjectPicker({
  options,
  value,
  onSelect,
}: {
  options: ProjOpt[];
  value: ProjOpt | null;
  onSelect: (p: ProjOpt | null) => void;
}) {
  const [focus, setFocus] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? options.filter((o) =>
          `${o.name} ${o.client}`.toLowerCase().includes(s)
        )
      : options;
    return base.slice(0, 12);
  }, [q, options]);

  if (value)
    return (
      <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">
            {value.name}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {value.client && `${value.client} · `}받을 돈 {won(value.amount)}
            {value.date && ` · ${value.date}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-slate-400 shrink-0 pl-2"
        >
          <X size={16} />
        </button>
      </div>
    );

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder="세금계산서 발급한 프로젝트 선택"
        autoComplete="off"
        className="pinp w-full"
      />
      {focus && matches.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((o) => (
            <li key={o.name}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(o);
                  setFocus(false);
                  setQ("");
                }}
                className="w-full px-3 py-2.5 text-left active:bg-indigo-50 hover:bg-indigo-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-700 truncate">
                    {o.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 shrink-0">
                    {won(o.amount)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {o.client}
                  {o.date && ` · ${o.date}`}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {focus && matches.length === 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2.5 text-sm text-slate-400">
          연결할 프로젝트가 없습니다 (이미 다 연결했거나 프로젝트 없음)
        </div>
      )}
    </div>
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
