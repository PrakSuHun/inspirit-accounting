"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(sp.get("from") || "/");
      router.refresh();
    } else {
      setErr("비밀번호가 틀렸습니다.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-slate-100 p-7"
      >
        <div className="text-2xl font-bold text-slate-900">인스피릿 장부</div>
        <p className="text-sm text-slate-400 mt-1 mb-6">
          영상·사진 사업 재무 대시보드
        </p>
        <input
          type="password"
          inputMode="text"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
        <button
          disabled={loading}
          className="w-full mt-4 rounded-xl bg-indigo-600 text-white py-3 font-semibold disabled:opacity-50 active:scale-[0.99] transition"
        >
          {loading ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
