import { loadLedger, loadFilings } from "@/lib/data";
import {
  withholdingSchedule,
  withholdingPayments,
  freelancerSet,
} from "@/lib/tax";
import { AppHeader } from "@/components/ui";
import Payroll from "@/components/Payroll";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const ledger = await loadLedger();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const day = now.getDate();
  const calendarMonth = `${y}-${pad(mo)}`; // 실제 이번 달
  // 신고 기준 기본 월: 매월 10일까지는 '전월'(신고 대상), 10일 지나면 '이번 달'
  let dy = y;
  let dmo = mo;
  if (day <= 10) {
    dmo -= 1;
    if (dmo === 0) {
      dmo = 12;
      dy -= 1;
    }
  }
  const defaultMonth = `${dy}-${pad(dmo)}`;

  const today = `${y}-${pad(mo)}-${pad(day)}`;
  const filings = await loadFilings();
  const schedule = withholdingSchedule(ledger, filings, today);
  const payments = withholdingPayments(ledger);
  const fl = [...freelancerSet(ledger)];
  const projects = ledger.projects.map((p) => p["프로젝트명(내부)"]);

  return (
    <main>
      <AppHeader title="인건비 · 원천세" subtitle="매월 10일 신고 · 사업소득 3.3%" />
      <Payroll
        schedule={schedule}
        payments={payments}
        freelancers={fl}
        projects={projects}
        defaultMonth={defaultMonth}
        calendarMonth={calendarMonth}
      />
    </main>
  );
}
