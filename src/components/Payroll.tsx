"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { won, manwon } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";
import { Plus, X, Upload, Download, Trash2, ChevronDown } from "lucide-react";
import MoneyInput from "./MoneyInput";

type FilingRow = {
  귀속연월: string;
  인원: number;
  지급총액: number;
  징수세액합: number;
  신고기한: string;
  filed: boolean;
  status: "완료" | "지연" | "이번신고" | "예정";
};
type Payment = {
  지급일: string;
  귀속연월: string;
  수령인: string;
  지급총액: number;
  원천세합: number;
  실지급액: number;
  프로젝트: string;
  내용: string;
  출처: "project" | "payroll";
};

type PersonAgg = {
  수령인: string;
  지급총액: number;
  실지급액: number;
  원천세: number;
  pays: Payment[];
};

export default function Payroll({
  schedule,
  payments,
  freelancers,
  projects,
  defaultMonth,
  calendarMonth,
}: {
  schedule: FilingRow[];
  payments: Payment[];
  freelancers: string[];
  projects: string[];
  defaultMonth: string;
  calendarMonth: string;
}) {
  const router = useRouter();
  const [savingYm, setSavingYm] = useState<string | null>(null);
  const [delKey, setDelKey] = useState<string | null>(null);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [showYear, setShowYear] = useState<"2025" | "2026">("2026");

  const overdue = schedule.filter((s) => s.status === "지연");
  const scheduleMap = new Map(schedule.map((s) => [s.귀속연월, s]));

  // 월 목록: 신고기준월 + 이번달(데이터 없어도) + 지급 있는 월, 최신순
  const months = useMemo(
    () =>
      [...new Set([defaultMonth, calendarMonth, ...payments.map((p) => p.귀속연월)])]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a)),
    [payments, defaultMonth, calendarMonth]
  );
  // 기본 = 신고기준월 (10일까지 전월분, 10일 지나면 이번달). 달 바뀌면 자동.
  const [month, setMonth] = useState(defaultMonth);

  // 선택한 달
  const monthPays = useMemo(
    () => payments.filter((p) => p.귀속연월 === month),
    [payments, month]
  );
  const sum = monthPays.reduce(
    (a, p) => ({
      지급총액: a.지급총액 + p.지급총액,
      실지급액: a.실지급액 + p.실지급액,
      원천세: a.원천세 + p.원천세합,
    }),
    { 지급총액: 0, 실지급액: 0, 원천세: 0 }
  );
  const byPerson: PersonAgg[] = useMemo(() => {
    const m = new Map<string, PersonAgg>();
    for (const p of monthPays) {
      let r = m.get(p.수령인);
      if (!r) {
        r = { 수령인: p.수령인, 지급총액: 0, 실지급액: 0, 원천세: 0, pays: [] };
        m.set(p.수령인, r);
      }
      r.지급총액 += p.지급총액;
      r.실지급액 += p.실지급액;
      r.원천세 += p.원천세합;
      r.pays.push(p);
    }
    return [...m.values()].sort((a, b) => b.지급총액 - a.지급총액);
  }, [monthPays]);

  const monthFiling = scheduleMap.get(month);

  async function toggleFiled(귀속월: string, filed: boolean) {
    setSavingYm(귀속월);
    try {
      const res = await fetch("/api/payroll/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 귀속월, filed }),
      });
      const json = await res.json().catch(() => ({ ok: res.ok }));
      if (!res.ok || !json.ok) {
        alert(`신고 상태 저장 실패: ${json.error || res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      alert(`신고 상태 저장 실패: ${(e as Error).message}`);
    } finally {
      setSavingYm(null);
    }
  }

  async function del(p: Payment) {
    if (!confirm(`${p.지급일} ${p.수령인} ${won(p.지급총액)} 기록을 삭제할까요?`))
      return;
    setDelKey(p.지급일 + p.수령인 + p.지급총액);
    await fetch("/api/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        match: {
          프로젝트: p.프로젝트,
          지출일: p.지급일,
          내용: p.내용,
          금액: p.지급총액,
        },
      }),
    });
    setDelKey(null);
    router.refresh();
  }

  return (
    <div>
      {/* ★ 급여 내역 (월별 조회) */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-500">급여 내역</span>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setOpenPerson(null);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium"
          >
            {months.length === 0 && <option value="">내역 없음</option>}
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* 월 합계 카드 */}
        <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-sm opacity-90">{month || "—"} 지급 합계</span>
            {monthFiling && (
              <button
                onClick={() => toggleFiled(month, !monthFiling.filed)}
                disabled={savingYm === month}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition active:scale-95 disabled:opacity-60 ${
                  monthFiling.filed
                    ? "bg-emerald-400 text-white"
                    : "bg-white text-indigo-700"
                }`}
              >
                {savingYm === month
                  ? "저장중…"
                  : monthFiling.filed
                  ? "✓ 신고완료"
                  : "신고완료"}
              </button>
            )}
          </div>
          {monthFiling && (
            <div className="text-[11px] mt-1 opacity-85">
              {month} 귀속 · {monthFiling.신고기한}까지 신고
              {!monthFiling.filed && monthFiling.status === "지연" && (
                <span className="ml-1 font-semibold text-amber-200">
                  · 기한 지남
                </span>
              )}
            </div>
          )}
          <div className="text-3xl font-bold mt-1.5">{won(sum.지급총액)}</div>
          <div className="flex gap-4 mt-3 text-sm">
            <div>
              <div className="opacity-75 text-xs">실지급액</div>
              <div className="font-semibold">{won(sum.실지급액)}</div>
            </div>
            <div>
              <div className="opacity-75 text-xs">원천세</div>
              <div className="font-semibold">{won(sum.원천세)}</div>
            </div>
            <div>
              <div className="opacity-75 text-xs">인원</div>
              <div className="font-semibold">{byPerson.length}명</div>
            </div>
          </div>
        </div>

        {/* 사람별 — 클릭 시 프로젝트별 내역 펼침 */}
        <div className="mt-3 space-y-2">
          {byPerson.map((p) => {
            const open = openPerson === p.수령인;
            return (
              <Card key={p.수령인} className="overflow-hidden">
                <button
                  onClick={() => setOpenPerson(open ? null : p.수령인)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {p.수령인}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {p.pays.length}건
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-slate-300 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">
                      {won(p.지급총액)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      실지급 {won(p.실지급액)} · 원천세 {won(p.원천세)}
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 space-y-1.5">
                    {p.pays
                      .slice()
                      .sort((a, b) => b.지급일.localeCompare(a.지급일))
                      .map((pay, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <div className="min-w-0">
                            <div className="text-slate-700 truncate">
                              {pay.프로젝트 && pay.프로젝트 !== "인건비"
                                ? pay.프로젝트
                                : "인건비"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {pay.지급일}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className="text-slate-700">
                                {won(pay.지급총액)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                원천세 {won(pay.원천세합)}
                              </div>
                            </div>
                            {pay.출처 === "payroll" ? (
                              <span
                                title="공식 지급명세서 — 시트에서 수정"
                                className="text-[9px] text-slate-400 border border-slate-200 rounded px-1 py-0.5 shrink-0"
                              >
                                공식
                              </span>
                            ) : (
                              <button
                                onClick={() => del(pay)}
                                disabled={
                                  delKey === pay.지급일 + pay.수령인 + pay.지급총액
                                }
                                className="text-slate-300 hover:text-rose-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            );
          })}
          {byPerson.length === 0 && (
            <Card className="p-6">
              <p className="text-center text-sm text-slate-400">
                이 달 지급 내역이 없습니다.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* 기한 지난 미신고 — 칩을 탭하면 해당 월로 이동해서 신고완료 처리 */}
      {overdue.length > 0 && (
        <div className="px-5 mt-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-700">
            <span className="font-medium">⚠️ 기한 지난 미신고 (탭하면 이동)</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {overdue.map((o) => (
                <button
                  key={o.귀속연월}
                  onClick={() => {
                    setMonth(o.귀속연월);
                    setOpenPerson(null);
                  }}
                  className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-medium active:scale-95"
                >
                  {o.귀속연월}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 입력 */}
      <div className="px-5 mt-4 space-y-3">
        <AddPayment freelancers={freelancers} projects={projects} />
        <BulkUpload />
      </div>

      {/* 연말 지급명세서 다운로드 */}
      <SectionTitle>연말 지급명세서 (제출용 다운로드)</SectionTitle>
      <div className="px-5 pb-4">
        <div className="flex gap-2 mb-2.5">
          {(["2025", "2026"] as const).map((y) => (
            <button
              key={y}
              onClick={() => setShowYear(y)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                showYear === y
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <a
            href={`/api/payroll/export?type=jiup&year=${showYear}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 p-3.5 active:scale-[0.99]"
          >
            <span className="text-sm text-slate-700">
              지급명세서 ({showYear}, 인별 합계)
            </span>
            <Download size={17} className="text-indigo-500" />
          </a>
          <a
            href={`/api/payroll/export?type=witax&year=${showYear}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 p-3.5 active:scale-[0.99]"
          >
            <span className="text-sm text-slate-700">
              위택스 특별징수 ({showYear}, 지방소득세)
            </span>
            <Download size={17} className="text-indigo-500" />
          </a>
        </div>
      </div>
    </div>
  );
}

// 모바일에서 datalist 가 안 뜨는 문제 → 직접 만든 자동완성 드롭다운
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

function AddPayment({
  freelancers,
  projects,
}: {
  freelancers: string[];
  projects: string[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    지급일: today,
    수령인: "",
    주민번호: "",
    금액: "",
    프로젝트: "",
  });

  const 금액n = Number(f.금액) || 0;
  const 국세 = Math.floor((금액n * 0.03) / 10) * 10;
  const 지방 = Math.floor((금액n * 0.003) / 10) * 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.수령인 || !f.금액) {
      setErr("수령인과 금액은 필수입니다.");
      return;
    }
    if (!f.지급일) {
      setErr("지급일을 입력하세요. 날짜가 없으면 인건비 목록에 안 떠요.");
      return;
    }
    setSaving(true);
    setErr("");
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", payment: f }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setF({ 지급일: today, 수령인: "", 주민번호: "", 금액: "", 프로젝트: "" });
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
        <Plus size={16} /> 인건비 지급 추가
      </button>
    );

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          누구에게 얼마 지급했나요?
        </span>
        <button type="button" onClick={() => setOpen(false)}>
          <X size={18} className="text-slate-400" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={f.지급일}
          onChange={(e) => setF({ ...f, 지급일: e.target.value })}
          className="pinp"
        />
        <Typeahead
          value={f.수령인}
          onChange={(v) => setF({ ...f, 수령인: v })}
          options={freelancers}
          placeholder="수령인(프리랜서)"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MoneyInput
          value={Number(f.금액) || 0}
          onChange={(n) => setF({ ...f, 금액: n ? String(n) : "" })}
          placeholder="지급총액(세전)"
          className="pinp"
        />
        <input
          value={f.주민번호}
          onChange={(e) => setF({ ...f, 주민번호: e.target.value })}
          placeholder="주민번호(선택)"
          className="pinp"
        />
      </div>
      <Typeahead
        value={f.프로젝트}
        onChange={(v) => setF({ ...f, 프로젝트: v })}
        options={[...projects].reverse()}
        placeholder="연결 프로젝트(선택)"
      />
      {금액n > 0 && (
        <p className="text-xs text-slate-500">
          원천세 {won(국세 + 지방)} (국세 {won(국세)} + 지방 {won(지방)}) → 실지급{" "}
          <b>{won(금액n - 국세 - 지방)}</b>
        </p>
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}
      <button
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-semibold disabled:opacity-50"
      >
        {saving ? "저장 중…" : "기록 추가"}
      </button>
      <style>{`.pinp{box-sizing:border-box;width:100%;border-radius:0.625rem;border:1px solid #e2e8f0;background:#fff;padding:0.5rem 0.75rem;font-size:0.9rem;line-height:1.4;font-family:inherit;-webkit-appearance:none;appearance:none}.pinp:focus{outline:none;box-shadow:0 0 0 2px #6366f1}input[type="date"].pinp::-webkit-date-and-time-value{text-align:left;margin:0}input[type="date"].pinp::-webkit-calendar-picker-indicator{margin:0;padding:0}`}</style>
    </form>
  );
}

function BulkUpload() {
  const router = useRouter();
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult("");
    const buf = await file.arrayBuffer();
    const b64 = btoa(
      new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
    );
    const res = await fetch("/api/payroll/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, data: b64 }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      setResult(`✅ ${json.added}건 등록 (신규 ${json.newPartners}명).`);
      router.refresh();
    } else setResult(`⚠️ ${json.error || "업로드 실패"}`);
  }

  return (
    <details className="rounded-2xl border border-slate-100 bg-white p-4">
      <summary className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer list-none">
        <Upload size={15} /> 엑셀로 한꺼번에 등록 / 템플릿
      </summary>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
        컬럼: <b>지급일, 수령인, 주민번호, 지급액, 프로젝트(선택)</b>. 업로드하면
        전부 기록되고 원천세가 자동 계산됩니다.
      </p>
      <a
        href="/api/payroll/template"
        className="inline-block text-xs text-indigo-600 font-medium underline mt-2"
      >
        템플릿 다운로드
      </a>
      <label className="mt-2 block">
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={onFile}
          disabled={loading}
          className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold"
        />
      </label>
      {loading && <p className="text-xs text-indigo-500 mt-2">처리 중…</p>}
      {result && <p className="text-sm text-slate-600 mt-2">{result}</p>}
    </details>
  );
}
