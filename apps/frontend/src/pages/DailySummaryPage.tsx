export function DailySummaryPage() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Daily Commit Summary Tool</p>
          <h1>Daily summary</h1>
          <p className="subtitle">A clear view of recent repository activity for project managers.</p>
        </div>
        <button className="primary-button" type="button" disabled>
          Generate summary
        </button>
      </header>

      <section aria-labelledby="summary-heading" className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">
          -
        </div>
        <h2 id="summary-heading">No report generated yet</h2>
        <p>Generate a summary to review commits from the last 24 hours.</p>
        <p className="muted">Report controls and live report data will be connected in the next feature tasks.</p>
      </section>
    </main>
  );
}
