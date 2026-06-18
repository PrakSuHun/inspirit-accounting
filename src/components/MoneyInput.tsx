"use client";

// 금액 입력 칸: 천단위 콤마로 표시(1,000,000)하면서 값은 숫자로 관리
export default function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value ? value.toLocaleString("ko-KR") : ""}
      onChange={(e) =>
        onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)
      }
      placeholder={placeholder}
      className={className}
    />
  );
}
