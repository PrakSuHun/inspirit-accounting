"use client";
import { Download } from "lucide-react";

const exports = [
  { tab: "projects", label: "프로젝트 (매출)" },
  { tab: "project_costs", label: "지출 내역 (원천세 포함)" },
  { tab: "tax_invoices", label: "세금계산서" },
  { tab: "common_expenses", label: "공통경비 (판관비)" },
  { tab: "card_input_vat", label: "카드 매입세액" },
];

export default function ExportButtons() {
  return (
    <div className="space-y-2.5">
      {exports.map((e) => (
        <a
          key={e.tab}
          href={`/api/export?tab=${e.tab}`}
          className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.99] transition"
        >
          <span className="text-sm font-medium text-slate-700">{e.label}</span>
          <Download size={18} className="text-indigo-500" />
        </a>
      ))}
    </div>
  );
}
