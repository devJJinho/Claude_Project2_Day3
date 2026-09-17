import type { ReactNode } from "react";

type StatColor = "purple" | "orange" | "blue" | "green";

// dataviz 스킬 팔레트 검증(라이트 서피스 기준 PASS, 대비 WARN) — 그래서 색은 아이콘 배경에만
// 쓰고, 값/라벨 텍스트는 항상 --text-* 토큰(검정에 가까운 잉크)으로 그린다. 색만으로 의미를
// 구분하지 않는다.
export function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: StatColor; icon: ReactNode }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}>
        {icon}
      </div>
      <div>
        <p className="stat-card-value">{value}</p>
        <p className="stat-card-label">{label}</p>
      </div>
    </div>
  );
}
