"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FolderKanban,
  Users,
  Wallet,
  Receipt,
} from "lucide-react";

const items = [
  { href: "/", label: "대시보드", icon: LayoutGrid },
  { href: "/projects", label: "프로젝트", icon: FolderKanban },
  { href: "/payroll", label: "인건비", icon: Users },
  { href: "/expenses", label: "공통경비", icon: Wallet },
  { href: "/tax", label: "세금", icon: Receipt },
];

export default function BottomNav() {
  const path = usePathname();
  if (path === "/login") return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40">
      <div className="mx-auto max-w-md bg-white/90 backdrop-blur border-t border-slate-100 px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-5">
          {items.map((it) => {
            const active =
              it.href === "/" ? path === "/" : path.startsWith(it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition ${
                  active ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-[11px] font-medium">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
