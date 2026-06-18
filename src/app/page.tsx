import {
  loadLedger,
  rollupProjects,
  monthlyRevenue,
  businessAccountCost,
  businessAccountBalance,
} from "@/lib/data";
import {
  vatByPeriod,
  financialsByYear,
  computeFinancials,
  availableMonths,
  taxableIncomeByYear,
  estimateIncomeTax,
} from "@/lib/tax";
import { won, manwon, pct } from "@/lib/format";
import { AppHeader, Card, StatCard, SectionTitle } from "@/components/ui";
import { RevenueBar, ProfitDonut } from "@/components/Charts";
import PeriodPL from "@/components/PeriodPL";
import BalanceCard from "@/components/BalanceCard";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const ledger = await loadLedger();
  const rolls = rollupProjects(ledger);
  const months = monthlyRevenue(ledger);

  // 기간별 손익 (연도 + 월)
  const byYear = financialsByYear(ledger);
  const years = Object.keys(byYear).sort();
  const monthList = availableMonths(ledger);
  const byMonth: Record<string, ReturnType<typeof computeFinancials>> = {};
  for (const m of monthList) byMonth[m] = computeFinancials(ledger, m);
  const curYear = new Date().getFullYear().toString();
  const defaultYear = years.includes(curYear) ? curYear : years[years.length - 1];

  // 전역 지표: 부가세(다음신고) · 예상소득세(올해) · 사업자통장 총비용
  const { periods } = vatByPeriod(ledger);
  const nextVat = periods[periods.length - 1];
  const 부가세납부 = Math.max(0, nextVat?.납부세액 ?? 0);
  const incomeByYear = taxableIncomeByYear(ledger);
  const 예상소득세 = estimateIncomeTax(incomeByYear[defaultYear] ?? 0).총부담;
  const 사업자통장총비용 = businessAccountCost(ledger, defaultYear);
  const 통장 = businessAccountBalance(ledger);

  // 수익성 (중개 vs 자체)
  const 중개 = rolls.filter((r) => r.유형 === "중개");
  const 자체 = rolls.filter((r) => r.유형 === "자체제작");
  const 중개매출 = 중개.reduce((s, r) => s + r.project.공급가, 0);
  const 자체매출 = 자체.reduce((s, r) => s + r.project.공급가, 0);
  const 자체마진 = 자체.reduce((s, r) => s + r.마진_경영, 0);
  const 자체마진율 = 자체매출 > 0 ? 자체마진 / 자체매출 : 0;

  return (
    <main>
      <AppHeader title="대시보드" subtitle="경영 현황" />

      {/* 순이익 = 사업자통장 실제 잔고 (통장 + 세이프박스, 수동 입력) */}
      <div className="px-5 mb-1">
        <BalanceCard 합계={통장.합계} 갱신일={통장.갱신일} />
      </div>

      {/* 기간 선택 손익 (분석용 · 매출 + 부가세 카드 포함) */}
      <PeriodPL
        byYear={byYear}
        byMonth={byMonth}
        years={years}
        months={monthList}
        defaultYear={defaultYear}
        vatAmount={부가세납부}
        vatPeriod={nextVat?.period ?? "-"}
      />

      {/* 전역: 예상 소득세 · 사업자통장 총비용 */}
      <div className="px-5 grid grid-cols-2 gap-3 mt-3">
        <StatCard
          label={`예상 소득세 (${defaultYear})`}
          value={manwon(예상소득세)}
          accent="text-rose-600"
          sub="종소세 추정(국세+지방)"
        />
        <StatCard
          label={`공통경비 (${defaultYear})`}
          value={manwon(사업자통장총비용)}
          accent="text-slate-700"
          sub="카드·월세·회식 등 (인건비는 지급명세서 별도)"
        />
      </div>

      <SectionTitle>월별 매출 추이 (입금완료)</SectionTitle>
      <div className="px-5">
        <Card className="p-4 pt-5">
          <RevenueBar data={months} />
        </Card>
      </div>

      <SectionTitle>수익원 구조 (중개 vs 자체제작)</SectionTitle>
      <div className="px-5 space-y-3 pb-4">
        <Card className="p-4">
          <ProfitDonut
            data={[
              { name: "자체제작", value: 자체매출 },
              { name: "중개", value: 중개매출 },
            ]}
          />
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label={`자체제작 ${자체.length}건`}
            value={pct(자체마진율)}
            accent="text-emerald-600"
            sub={`마진 ${manwon(자체마진)} · 진짜 수익원`}
          />
          <StatCard
            label={`중개 ${중개.length}건`}
            value={manwon(중개매출)}
            accent="text-amber-600"
            sub="마진 거의 없음 · 관계/현금흐름용"
          />
        </div>
      </div>
    </main>
  );
}
