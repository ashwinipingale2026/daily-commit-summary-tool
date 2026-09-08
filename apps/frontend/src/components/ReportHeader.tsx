import type { Report } from "../types/api";

interface ReportHeaderProps {
  report: Report | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onDownload: () => void;
}

export function ReportHeader({ report, isGenerating, onGenerate, onDownload }: ReportHeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Daily Commit Summary Tool</p>
        <h1>Daily summary</h1>
        <p className="subtitle">A clear view of recent repository activity for project managers.</p>
      </div>
      <div className="header-actions">
        <button className="secondary-button" type="button" onClick={onDownload} disabled={!report || isGenerating}>
          Download Markdown
        </button>
        <button className="primary-button" type="button" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Generate summary"}
        </button>
      </div>
    </header>
  );
}
