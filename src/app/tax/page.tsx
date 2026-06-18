import { loadLedger, taxStatusMap } from "@/lib/data";
import {
  vatByPeriod,
  taxableIncomeByYear,
  deductibleByYear,
  invoicedRevenueByYear,
  estimateIncomeTax,
  withholdingByMonth,
} from "@/lib/tax";
import { won, manwon } from "@/lib/format";
import {
  AppHeader,
  Card,
  HeroCard,
  StatCard,
  Gauge,
  SectionTitle,
} from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TaxPage() {
  const ledger = loadLedger();
  const { periods, 카드매입_연간 } = vatByPeriod(ledger);
  const income = taxableIncomeByYear(ledger);
  const ded = deductibleByYear(ledger);
  const rev = invoicedRevenueByYear(ledger);
  const tax = taxStatusMap(ledger);
  const 세이프박스 = tax["[세이프박스] 추정 적립잔액(통장)"] ?? 0;

  // 다음 신고 = 가장 최근 과세기간
  const next = periods[periods.length - 1];
  const nextYear = next?.period.slice(0, 4) ?? "2026";
  const 카드올해 = 카드매입_연간[nextYear] ?? 0;

  const monthly = withholdingByMonth(ledger);
  const 원천세누적 = monthly.reduce((s, m) => s + m.징수세액합, 0);

  const years = Object.keys(income).sort();

  return (
    <main>
      <AppHeader title="세금" subtitle="실시간 계산 · 신고 도우미" />

      {/* 부가세 다음 신고 */}
      <div className="px-5 space-y-3">
        <HeroCard
          label={`다음 부가세 신고 (${next?.period ?? "-"})`}
          value={won(next?.납부세액 ?? 0)}
          sub={`세금계산서 기준 · 카드매입세액(${nextYear} 연간 ${manwon(
            카드올해
          )})은 신고 시 추가 차감`}
          tone="rose"
        />
      </div>

      {/* 부가세 과세기간별 */}
      <SectionTitle>부가세 과세기간별 (매출세액 − 매입세액)</SectionTitle>
      <div className="px-5">
        <Card className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="text-left font-medium pb-2">과세기간</th>
                <th className="text-right font-medium pb-2">매출세액</th>
                <th className="text-right font-medium pb-2">매입세액</th>
                <th className="text-right font-medium pb-2">납부/환급</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.period} className="border-t border-slate-50">
                  <td className="py-1.5 text-slate-600">{p.period}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">
                    {p.매출세액.toLocaleString("ko-KR")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">
                    {p.매입세액_계산서.toLocaleString("ko-KR")}
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums font-semibold ${
                      p.납부세액 >= 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {p.납부세액 >= 0
                      ? p.납부세액.toLocaleString("ko-KR")
                      : `(환급 ${Math.abs(p.납부세액).toLocaleString("ko-KR")})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            ※ 카드 매입세액은 연 단위 집계라 위 표(세금계산서)와 별도입니다. 실제
            신고 시 해당 기간 카드 매입세액을 추가로 차감하세요.
          </p>
        </Card>
      </div>

      {/* 세이프박스 */}
      <SectionTitle>세금 세이프박스</SectionTitle>
      <div className="px-5">
        <Gauge
          label="부가세 다음 납부 대비 적립"
          current={세이프박스}
          target={Math.max(0, next?.납부세액 ?? 0)}
        />
      </div>

      {/* 종합소득세 — 공제 기반 (매출 − 필요경비) */}
      <SectionTitle>종합소득세 (공제 기반 추정)</SectionTitle>
      <div className="px-5 space-y-3">
        {years.map((y) => {
          const est = estimateIncomeTax(income[y]);
          const d = ded[y] ?? {
            세금계산서매입: 0,
            카드매입: 0,
            프리랜서인건비: 0,
            감가상각: 0,
            합계: 0,
          };
          return (
            <Card key={y} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800">{y}년</span>
                <span className="text-xs text-slate-400">
                  세율 {(est.세율 * 100).toFixed(0)}% 구간
                </span>
              </div>
              {/* 매출 − 공제 = 소득금액 */}
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <span className="text-slate-500">매출(세금계산서)</span>
                <span className="text-right">{won(rev[y] ?? 0)}</span>
                <span className="text-slate-400 pl-2">− 세금계산서 매입</span>
                <span className="text-right text-slate-500">
                  {won(d.세금계산서매입)}
                </span>
                <span className="text-slate-400 pl-2">− 카드 매입</span>
                <span className="text-right text-slate-500">{won(d.카드매입)}</span>
                <span className="text-slate-400 pl-2">− 프리랜서 인건비</span>
                <span className="text-right text-slate-500">
                  {won(d.프리랜서인건비)}
                </span>
                <span className="text-slate-400 pl-2">− 감가상각</span>
                <span className="text-right text-slate-500">{won(d.감가상각)}</span>
                <span className="font-medium text-slate-700 border-t border-slate-100 pt-1">
                  = 소득금액
                </span>
                <span className="text-right font-semibold border-t border-slate-100 pt-1">
                  {won(est.소득금액)}
                </span>
                <span className="font-medium text-slate-700">결정세액(국세)</span>
                <span className="text-right font-bold text-rose-600">
                  {won(est.결정세액)}
                </span>
                <span className="text-slate-400">+ 지방소득세(10%)</span>
                <span className="text-right text-slate-500">
                  {won(est.지방소득세)}
                </span>
                <span className="font-bold text-slate-800">총 세부담</span>
                <span className="text-right font-bold text-slate-900">
                  {won(est.총부담)}
                </span>
              </div>
            </Card>
          );
        })}
        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          ※ 공제 가능한 비용(세금계산서·사업용카드·프리랜서 인건비·감가)만 차감.
          식비·해외여행 등 공제 불가 항목은 제외(대시보드에만 반영). 본인공제
          150만·표준세액공제 7만 반영, 부양가족·기납부 등 미반영 추정치.
        </p>
      </div>

      {/* 원천세 요약 → 인건비 탭 */}
      <SectionTitle>원천세 (프리랜서 3.3%)</SectionTitle>
      <div className="px-5 pb-4">
        <Link href="/payroll">
          <Card className="p-4 active:scale-[0.99] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800">
                  누적 원천징수 {manwon(원천세누적)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  월별·인별 명세, 지급명세서·위택스 export →
                </div>
              </div>
              <StatChevron />
            </div>
          </Card>
        </Link>
      </div>
    </main>
  );
}

function StatChevron() {
  return <span className="text-indigo-400 text-xl">›</span>;
}
