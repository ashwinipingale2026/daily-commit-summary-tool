import { useCallback, useEffect, useState } from "react";
import { AuthorCard } from "../components/AuthorCard";
import { ReportHeader } from "../components/ReportHeader";
import { StatusMessage } from "../components/StatusMessage";
import { Totals } from "../components/Totals";
import { ApiClientError, reportApiClient } from "../services/api-client";
import type { Report } from "../types/api";

function messageForError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.details.code === "INVALID_REPOSITORY" || error.details.code === "DETACHED_HEAD") {
      return "The configured repository is unavailable. Check the backend repository configuration.";
    }
    return error.message;
  }
  return "The report could not be loaded. Try again.";
}

function downloadBlob(blob: Blob, reportId: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `commit-summary-${reportId}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function dedupeWarnings(warnings: Report["warnings"]): Report["warnings"] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}::${warning.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function DailySummaryPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setReport(await reportApiClient.getLatestReport());
    } catch (error) {
      setErrorMessage(messageForError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  async function handleGenerate() {
    if (isGenerating) {
      return;
    }
    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await reportApiClient.generateReport();
      if (response.status === "no_data") {
        setStatusMessage(response.message);
      } else {
        setReport(response.report);
        setStatusMessage(response.status === "partial_success" ? "Report generated with warnings." : null);
      }
    } catch (error) {
      setErrorMessage(messageForError(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload() {
    if (!report) {
      return;
    }
    try {
      downloadBlob(await reportApiClient.downloadMarkdown(report.id), report.id);
    } catch (error) {
      setErrorMessage(messageForError(error));
    }
  }

  return (
    <main className="app-shell">
      <ReportHeader report={report} isGenerating={isGenerating} onGenerate={() => void handleGenerate()} onDownload={() => void handleDownload()} />
      {isLoading ? <StatusMessage kind="loading" message="Loading the latest report..." /> : null}
      {isGenerating ? <StatusMessage kind="loading" message="Collecting commits and generating summary..." /> : null}
      {errorMessage ? <StatusMessage kind="error" message={errorMessage} actionLabel="Try again" onAction={() => void loadLatest()} /> : null}
      {statusMessage && !isGenerating ? <StatusMessage kind="empty" message={statusMessage} /> : null}
      {!isLoading && !report && !isGenerating && !errorMessage && !statusMessage ? (
        <StatusMessage kind="empty" message="No commits in the last 24 hours - report not generated." />
      ) : null}
      {report ? (
        <>
          <section className="panel report-meta" aria-labelledby="report-meta-heading">
            <div>
              <p className="eyebrow">Latest report</p>
              <h2 id="report-meta-heading">{report.repository}</h2>
              <p className="muted">
                Branch <strong>{report.branch}</strong> · Last 24 hours · Generated {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
            <p className="window-label">
              {new Date(report.window.start).toLocaleDateString()} - {new Date(report.window.end).toLocaleDateString()}
            </p>
          </section>
          {report.warnings.length > 0 ? (
            <section className="warning-panel" aria-label="Report warnings" aria-live="polite">
              <strong>Notice</strong>
              {dedupeWarnings(report.warnings).map((warning) => <span key={`${warning.code}-${warning.message}`}>{warning.message}</span>)}
            </section>
          ) : null}
          <Totals totals={report.totals} />
          <section aria-labelledby="authors-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Evidence by contributor</p>
                <h2 id="authors-heading">Author summaries</h2>
              </div>
              <span className="muted">{report.authors.length} contributors</span>
            </div>
            <div className="author-list">
              {report.authors.map((author) => <AuthorCard author={author} key={`${author.name}-${author.email}`} />)}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
