export function won(n: number): string {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

// 만원 단위 축약 (카드용)
export function manwon(n: number): string {
  const m = n / 10000;
  if (Math.abs(m) >= 10000) return (m / 10000).toFixed(1) + "억";
  if (Math.abs(m) >= 1) return Math.round(m).toLocaleString("ko-KR") + "만";
  return Math.round(n).toLocaleString("ko-KR");
}

export function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}
