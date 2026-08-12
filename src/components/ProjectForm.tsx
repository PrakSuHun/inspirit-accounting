"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import MoneyInput from "./MoneyInput";

export type ProjectFormData = {
  "프로젝트명(내부)": string;
  클라이언트: string;
  납품일: string;
  상태: string;
  공급가: number;
  부가세: number;
  정산상태: string;
};

const 상태옵션 = ["작업중", "완료"];
const 정산옵션 = ["작업중", "입금 완료"];

export default function ProjectForm({
  mode,
  initial,
  clients,
}: {
  mode: "create" | "edit";
  initial?: Partial<ProjectFormData>;
  clients: string[];
}) {
  const router = useRouter();
  const [f, setF] = useState<ProjectFormData>({
    "프로젝트명(내부)": initial?.["프로젝트명(내부)"] ?? "",
    클라이언트: initial?.클라이언트 ?? "",
    납품일: initial?.납품일 ?? "",
    상태: initial?.상태 ?? "작업중",
    공급가: initial?.공급가 ?? 0,
    부가세: initial?.부가세 ?? 0,
    정산상태: initial?.정산상태 ?? "작업중",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set<K extends keyof ProjectFormData>(k: K, v: ProjectFormData[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  // 3칸 양방향 자동계산: 공급가 / 부가세 / 총 계약금액
  function onSupply(v: number) {
    // 공급가 입력 → 부가세 10% 자동, 총액 = 공급가 + 부가세
    setF((p) => ({ ...p, 공급가: v, 부가세: Math.round(v * 0.1) }));
  }
  function onVat(v: number) {
    // 부가세 직접 수정 → 공급가는 유지 (총액만 바뀜)
    setF((p) => ({ ...p, 부가세: v }));
  }
  function onTotal(total: number) {
    // 총 계약금액 입력 → 공급가 = 총액 ÷ 1.1, 부가세 = 나머지
    const 공급가 = Math.round(total / 1.1);
    setF((p) => ({ ...p, 공급가, 부가세: total - 공급가 }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f["프로젝트명(내부)"].trim()) {
      setErr("프로젝트명을 입력하세요.");
      return;
    }
    setSaving(true);
    setErr("");
    const payload =
      mode === "create"
        ? { action: "create", project: f }
        : {
            action: "update",
            name: initial?.["프로젝트명(내부)"],
            patch: {
              "프로젝트명(내부)": f["프로젝트명(내부)"].trim(),
              클라이언트: f.클라이언트,
              납품일: f.납품일,
              상태: f.상태,
              공급가: f.공급가,
              부가세: f.부가세,
              정산상태: f.정산상태,
            },
          };
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      if (mode === "create") router.push("/projects");
      else router.back();
      router.refresh();
    } else {
      setErr(json.error || "저장 실패");
    }
  }

  return (
    <form onSubmit={submit} className="px-5 space-y-4">
      <datalist id="clients-list">
        {clients.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <Field label="프로젝트명">
        <input
          value={f["프로젝트명(내부)"]}
          onChange={(e) => set("프로젝트명(내부)", e.target.value)}
          placeholder="예: 한남대 홍보영상"
          className="inp"
        />
        {mode === "edit" && (
          <p className="text-[11px] text-slate-400 mt-1">
            이름을 바꾸면 연결된 인건비·앤드원·세금계산서도 함께 바뀌어요.
          </p>
        )}
      </Field>

      <Field label="클라이언트">
        <input
          list="clients-list"
          value={f.클라이언트}
          onChange={(e) => set("클라이언트", e.target.value)}
          placeholder="거래처 검색·입력"
          className="inp"
        />
      </Field>

      <Field label="납품일">
        <input
          type="date"
          value={f.납품일}
          onChange={(e) => set("납품일", e.target.value)}
          className="inp"
        />
      </Field>

      {/* 총 계약금액 — 입력하면 공급가/부가세 역산 */}
      <Field label="총 계약금액 (부가세 포함)">
        <MoneyInput
          value={f.공급가 + f.부가세}
          onChange={onTotal}
          placeholder="총 받는 금액 입력"
          className="inp font-semibold"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 -mt-1">
        <Field label="공급가 (÷1.1 자동)">
          <MoneyInput value={f.공급가} onChange={onSupply} placeholder="0" className="inp" />
        </Field>
        <Field label="부가세 (10% 자동)">
          <MoneyInput value={f.부가세} onChange={onVat} placeholder="0" className="inp" />
        </Field>
      </div>
      <p className="text-xs text-slate-400 -mt-1">
        공급가 {f.공급가.toLocaleString("ko-KR")} + 부가세{" "}
        {f.부가세.toLocaleString("ko-KR")} ={" "}
        <b>{(f.공급가 + f.부가세).toLocaleString("ko-KR")}원</b>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="상태">
          <select
            value={f.상태}
            onChange={(e) => set("상태", e.target.value)}
            className="inp"
          >
            {상태옵션.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="정산상태">
          <select
            value={f.정산상태}
            onChange={(e) => set("정산상태", e.target.value)}
            className="inp"
          >
            {정산옵션.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <button
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold disabled:opacity-50 active:scale-[0.99] transition"
      >
        {saving ? "저장 중…" : mode === "create" ? "프로젝트 추가" : "저장"}
      </button>

      {mode === "edit" && (
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            if (
              !confirm(
                `"${initial?.["프로젝트명(내부)"]}" 프로젝트를 삭제할까요?\n연결된 인건비·지출·앤드원 내역도 함께 삭제됩니다. (세금계산서는 연결만 해제)`
              )
            )
              return;
            setSaving(true);
            await fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "delete",
                name: initial?.["프로젝트명(내부)"],
              }),
            });
            router.push("/projects");
            router.refresh();
          }}
          className="w-full text-sm text-rose-500 font-medium py-2"
        >
          프로젝트 삭제
        </button>
      )}

      <style>{`.inp{width:100%;border-radius:0.75rem;border:1px solid #e2e8f0;background:#fff;padding:0.625rem 0.875rem;font-size:0.95rem}.inp:focus{outline:none;box-shadow:0 0 0 2px #6366f1}`}</style>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
