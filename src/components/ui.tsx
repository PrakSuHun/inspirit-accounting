import Link from "next/link";

export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="px-5 pt-6 pb-3 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {right}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-3xl shadow-sm border border-slate-100 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-5 mt-6 mb-2 text-sm font-semibold text-slate-500">
      {children}
    </h2>
  );
}

// 큰 메인 요약 카드 (그라데이션)
export function HeroCard({
  label,
  value,
  sub,
  tone = "indigo",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "indigo" | "emerald" | "rose";
}) {
  const grad =
    tone === "emerald"
      ? "from-emerald-500 to-teal-600"
      : tone === "rose"
      ? "from-rose-500 to-pink-600"
      : "from-indigo-500 to-violet-600";
  return (
    <div
      className={`rounded-3xl bg-gradient-to-br ${grad} text-white p-5 shadow-md`}
    >
      <div className="text-sm/none opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-2 tracking-tight">{value}</div>
      {sub && <div className="text-xs opacity-80 mt-1">{sub}</div>}
    </div>
  );
}

// 작은 통계 카드
export function StatCard({
  label,
  value,
  sub,
  accent = "text-slate-900",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-lg font-bold mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </Card>
  );
}

// 세이프박스 게이지 (목표 대비)
export function Gauge({
  current,
  target,
  label,
}: {
  current: number;
  target: number;
  label: string;
}) {
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;
  const pct = Math.round(ratio * 100);
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className="text-xs text-slate-400">{pct}%</span>
      </div>
      <div className="mt-3 h-3 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}

export function LinkCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="p-4 active:scale-[0.99] transition">
        <div className="font-semibold text-slate-800">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
      </Card>
    </Link>
  );
}
