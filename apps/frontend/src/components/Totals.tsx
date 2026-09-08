import type { Report } from "../types/api";

interface TotalsProps {
  totals: Report["totals"];
}

export function Totals({ totals }: TotalsProps) {
  const items = [
    ["Commits", totals.commits],
    ["Authors", totals.authors],
    ["Files touched", totals.filesTouched],
    ["Lines added", totals.linesAdded],
    ["Lines removed", totals.linesRemoved],
  ];

  return (
    <section aria-labelledby="totals-heading" className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">At a glance</p>
          <h2 id="totals-heading">Activity totals</h2>
        </div>
      </div>
      <div className="totals-grid">
        {items.map(([label, value]) => (
          <div className="total-item" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
