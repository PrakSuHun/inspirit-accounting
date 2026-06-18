import { loadLedger } from "@/lib/data";
import { AppHeader } from "@/components/ui";
import Expenses from "@/components/Expenses";

export const dynamic = "force-dynamic";

export type ExpenseItem = {
  지출일: string;
  구분: string;
  항목: string;
  금액: number;
};

export default async function ExpensesPage() {
  const ledger = await loadLedger();
  // 최신순 정렬
  const items: ExpenseItem[] = [...ledger.common_expenses]
    .map((e) => ({ 지출일: e.지출일, 구분: e.구분, 항목: e.항목, 금액: e.금액 }))
    .sort((a, b) => String(b.지출일).localeCompare(String(a.지출일)));

  const categories = [...new Set(items.map((i) => i.구분).filter(Boolean))];

  return (
    <main>
      <AppHeader title="공통경비" subtitle="판관비 · 영업외 관리" />
      <Expenses items={items} categories={categories} />
    </main>
  );
}
