export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// 순수 SVG 도넛(외부 차트 라이브러리 없음). 범례를 항상 함께 그려 색만으로 구간을 구분하지
//않게 한다(dataviz 스킬 — "identity는 색만으로 전달하지 않는다").
export function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut-svg" role="img" aria-label={`${centerLabel} ${centerValue}건`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
        {segments.map((seg) => {
          const dash = (seg.value / total) * circumference;
          const el = (
            <circle
              key={seg.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += dash;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-center-value">
          {centerValue}
        </text>
        <text x="70" y="86" textAnchor="middle" className="donut-center-label">
          {centerLabel}
        </text>
      </svg>
      <ul className="donut-legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className="legend-dot" style={{ background: seg.color }} />
            <span className="legend-label">{seg.label}</span>
            <span className="legend-value">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
