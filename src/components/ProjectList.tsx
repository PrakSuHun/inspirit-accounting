"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { manwon, pct } from "@/lib/format";
import type { ProjectListItem } from "@/app/projects/page";

type SortKey = "date" | "margin" | "supply";
type Filter = "전체" | "중개" | "자체제작" | "미입금";

export default function ProjectList({ items }: { items: ProjectListItem[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [filter, setFilter] = useState<Filter>("전체");

  const view = useMemo(() => {
    let v = items;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      v = v.filter(
        (i) =>
          i.name.toLowerCase().includes(s) ||
          i.client.toLowerCase().includes(s)
      );
    }
    if (filter === "중개") v = v.filter((i) => i.type === "중개");
    else if (filter === "자체제작") v = v.filter((i) => i.type === "자체제작");
    else if (filter === "미입금")
      v = v.filter((i) => !i.settle.includes("완료"));

    const sorted = [...v];
    if (sort === "date")
      sorted.sort((a, b) => b.date.localeCompare(a.date));
    else if (sort === "margin") sorted.sort((a, b) => b.margin - a.margin);
    else if (sort === "supply") sorted.sort((a, b) => b.supply - a.supply);
    return sorted;
  }, [items, q, sort, filter]);

  return (
    <div className="px-5">
      {/* 검색 */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="프로젝트·클라이언트 검색"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* 필터 칩 */}
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
        {(["전체", "자체제작", "중개", "미입금"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 정렬 */}
      <div className="flex gap-3 mt-3 text-xs text-slate-400">
        {(
          [
            ["date", "최신순"],
            ["margin", "마진순"],
            ["supply", "매출순"],
          ] as [SortKey, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={sort === k ? "text-indigo-600 font-semibold" : ""}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <div className="mt-3 space-y-2.5">
        {view.map((i) => (
          <Link key={i.idx} href={`/projects/${i.idx}`}>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.99] transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">
                    {i.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {i.client} · {i.date || "납품일 미정"}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                    i.type === "중개"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {i.type}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm font-bold text-slate-900">
                  {manwon(i.supply)}
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    매출
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    마진 {manwon(i.margin)} ({pct(i.marginRate)})
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      i.settle.includes("완료")
                        ? "bg-slate-100 text-slate-500"
                        : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {i.settle || "미정"}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
        {view.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">
            검색 결과가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
