export function ProgressBar({
  label,
  resolved,
  total,
  color = "purple",
}: {
  label: string;
  resolved: number;
  total: number;
  color?: "purple" | "orange" | "blue" | "green";
}) {
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return (
    <div className="progress-row">
      <div className="progress-row-head">
        <span>{label}</span>
        <span className="progress-row-value">
          {resolved}/{total} 처리 ({pct}%)
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: `var(--${color})` }} />
      </div>
    </div>
  );
}
