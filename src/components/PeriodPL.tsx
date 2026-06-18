"use client";
import { useState } from "react";
import { won, manwon } from "@/lib/format";
import { Card, HeroCard, StatCard } from "@/components/ui";

type Fin = {
  매출: number;
  외주용역비: number;
  직접경비: number;
  공통경비: number;
  감가상각: number;
  영업외수익: number;
  영업외비용: number;
  대표인건비: number;
  경영순이익: number;
  세무소득금액: number;
};
const EMPTY: Fin = {
  매출: 0,
  외주용역비: 0,
  직접경비: 0,
  공통경비: 0,
  감가상각: 0,
  영업외수익: 0,
  영업외비용: 0,
  대표인건비: 0,
  경영순이익: 0,
  세무소득금액: 0,
};

function sumFin(list: Fin[]): Fin {
  return list.reduce(
    (a, f) => ({
      매출: a.매출 + f.매출,
      외주용역비: a.외주용역비 + f.외주용역비,
      직접경비: a.직접경비 + f.직접경비,
      공통경비: a.공통경비 + f.공통경비,
      감가상각: a.감가상각 + f.감가상각,
      영업외수익: a.영업외수익 + f.영업외수익,
      영업외비용: a.영업외비용 + f.영업외비용,
      대표인건비: a.대표인건비 + f.대표인건비,
      경영순이익: a.경영순이익 + f.경영순이익,
      세무소득금액: a.세무소득금액 + f.세무소득금액,
    }),
    EMPTY
  );
}

export default function PeriodPL({
  byYear,
  byMonth,
  years,
  months,
  defaultYear,
  vatAmount,
  vatPeriod,
}: {
  byYear: Record<string, Fin>;
  byMonth: Record<string, Fin>;
  years: string[];
  months: string[];
  defaultYear: string;
  vatAmount: number;
  vatPeriod: string;
}) {
  const [mode, setMode] = useState<"year" | "month" | "cumulative">("year");
  const [yearSel, setYearSel] = useState(defaultYear);
  const [monthSel, setMonthSel] = useState(months[0] ?? defaultYear + "-01");

  // 누적 = 모든 연도 합산
  const cumulative = sumFin(Object.values(byYear));
  const f =
    mode === "year"
      ? byYear[yearSel] ?? EMPTY
      : mode === "month"
      ? byMonth[monthSel] ?? EMPTY
      : cumulative;
  const label =
    mode === "year"
      ? `${yearSel}년`
      : mode === "month"
      ? monthSel
      : `누적 (${years[0] ?? ""}~)`;

  const rows: [string, number, boolean][] = [
    ["매출(입금완료 공급가)", f.매출, false],
    ["(−) 외주 용역비", f.외주용역비, false],
    ["(−) 직접경비", f.직접경비, false],
    ["(−) 공통경비(판관비)", f.공통경비, false],
    ["(−) 감가상각", f.감가상각, false],
    ["(+) 영업외수익", f.영업외수익, false],
    ["(−) 영업외비용", f.영업외비용, false],
    ["(−) 대표 인건비", f.대표인건비, false],
    ["= 경영 순이익", f.경영순이익, true],
  ];

  return (
    <div className="px-5 space-y-3">
      {/* 기간 선택 */}
      <div className="flex items-center gap-2">
        <div className="flex bg-slate-100 rounded-full p-0.5">
          {(["year", "month", "cumulative"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                mode === m ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
              }`}
            >
              {m === "year" ? "연도별" : m === "month" ? "월별" : "누적"}
            </button>
          ))}
        </div>
        {mode === "year" && (
          <select
            value={yearSel}
            onChange={(e) => setYearSel(e.target.value)}
            className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        )}
        {mode === "month" && (
          <select
            value={monthSel}
            onChange={(e) => setMonthSel(e.target.value)}
            className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-3xl bg-white border border-slate-100 p-4">
        <div className="text-xs text-slate-400">
          경영 손익 · {label} (분석 · 손익 기준)
        </div>
        <div
          className={`text-2xl font-bold mt-1 ${
            f.경영순이익 >= 0 ? "text-slate-800" : "text-rose-600"
          }`}
        >
          {won(f.경영순이익)}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          매출 − 비용(손익 기준) · 실제 통장 잔고와는 다름(위 순이익 참고)
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={`매출 · ${label}`} value={manwon(f.매출)} sub="입금완료분만" />
        <StatCard
          label={`부가세 (${vatPeriod} 신고)`}
          value={manwon(vatAmount)}
          accent="text-rose-600"
          sub="다음 납부분"
        />
      </div>

      {/* 손익표 */}
      <Card className="p-4">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([lab, val, emp]) => (
              <tr
                key={lab}
                className={`border-t border-slate-50 first:border-0 ${
                  emp ? "font-bold text-slate-800" : "text-slate-500"
                }`}
              >
                <td className="py-1.5 pr-2">{lab}</td>
                <td
                  className={`py-1.5 text-right tabular-nums ${
                    emp && val < 0 ? "text-rose-600" : ""
                  }`}
                >
                  {Math.round(val).toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
          ※ 경영용 · 매출은 입금완료(세금계산서 발행) 건만 집계. 세무 신고용
          소득금액은 세금 탭 참고.
        </p>
      </Card>
    </div>
  );
}
