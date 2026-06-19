// 페이지 전환 시 즉시 보이는 로딩 (구글시트 불러오는 동안)
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-md min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      <p className="text-sm text-slate-400">불러오는 중…</p>
    </div>
  );
}
