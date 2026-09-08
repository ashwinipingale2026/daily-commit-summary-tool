import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { DailySummaryPage } from "./DailySummaryPage";
import { ApiClientError, reportApiClient } from "../services/api-client";
import type { Report } from "../types/api";

function createReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "report-1",
    repository: "daily-summary",
    branch: "main",
    window: { start: "2026-09-08T00:00:00.000Z", end: "2026-09-09T00:00:00.000Z" },
    generatedAt: "2026-09-09T00:01:00.000Z",
    totals: { commits: 1, authors: 1, filesTouched: 1, linesAdded: 2, linesRemoved: 1 },
    authors: [{
      name: "Ada Lovelace",
      email: "ada@example.com",
      activity: { level: "high", score: 31 },
      metrics: { commits: 1, filesTouched: 1, linesAdded: 2, linesRemoved: 1 },
      summary: { text: "Updated the report.", source: "fallback", status: "available", warning: null },
      commits: [{
        commitHash: "abcdef123",
        shortHash: "abcdef1",
        authorName: "Ada Lovelace",
        authorEmail: "ada@example.com",
        authorTimestamp: "2026-09-09T00:00:00.000Z",
        committerTimestamp: "2026-09-09T00:00:00.000Z",
        subject: "Update report",
        body: null,
        filesChanged: [{ path: "src/report.ts", additions: 2, deletions: 1, binary: false }],
        binary: false,
        fileCount: 1,
        linesAdded: 2,
        linesRemoved: 1,
      }],
    }],
    warnings: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DailySummaryPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DailySummaryPage", () => {
  it("announces initial loading and renders the loaded report with textual activity level", async () => {
    let release!: (report: Report) => void;
    const latest = vi.spyOn(reportApiClient, "getLatestReport").mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );

    renderPage();

    expect(screen.getByText("Loading the latest report...").closest("section")).toHaveAttribute("aria-live", "polite");
    await act(async () => {
      release(createReport());
    });
    expect(await screen.findByRole("heading", { name: "daily-summary" })).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(latest).toHaveBeenCalledOnce();
  });

  it("shows no-data feedback and preserves an existing report while generation is active", async () => {
    let release!: (value: { status: "no_data"; message: string; requestId: string }) => void;
    vi.spyOn(reportApiClient, "getLatestReport").mockResolvedValue(createReport());
    const generate = vi.spyOn(reportApiClient, "generateReport").mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );
    const user = userEvent.setup();

    renderPage();
    await screen.findByRole("heading", { name: "daily-summary" });
    await user.click(screen.getByRole("button", { name: "Generate summary" }));

    expect(screen.getByRole("button", { name: "Generating..." })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "daily-summary" })).toBeInTheDocument();
    expect(screen.getByText("Collecting commits and generating summary...").closest("section")).toHaveAttribute("aria-live", "polite");

    await act(async () => {
      release({ status: "no_data", message: "No commits in the last 24 hours - report not generated.", requestId: "request-1" });
    });

    expect(await screen.findByText("No commits in the last 24 hours - report not generated.")).toBeInTheDocument();
    expect(generate).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "daily-summary" })).toBeInTheDocument();
  });

  it("renders partial-success warnings and expands evidence with keyboard interaction", async () => {
    vi.spyOn(reportApiClient, "getLatestReport").mockResolvedValue(createReport({
      warnings: [{ code: "AI_SUMMARY_FALLBACK", message: "AI summaries are unavailable" }],
    }));
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("AI summaries are unavailable");

    const evidence = screen.getByText("View 1 commit evidence items");
    evidence.focus();
    await user.keyboard("{Enter}");
    await user.click(evidence);

    expect(evidence.parentElement).toHaveAttribute("open");
    expect(screen.getByText("Update report")).toBeInTheDocument();
  });

  it("announces recoverable errors and retries the initial load", async () => {
    const error = new ApiClientError("The backend service could not be reached", {
      status: "error",
      code: "BACKEND_UNAVAILABLE",
      message: "The backend service could not be reached",
      retryable: true,
      requestId: "request-1",
    });
    const latest = vi.spyOn(reportApiClient, "getLatestReport")
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(createReport());
    const user = userEvent.setup();

    renderPage();
    const errorMessage = await screen.findByText("The backend service could not be reached");
    expect(errorMessage.parentElement).toHaveAttribute("aria-live", "polite");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "daily-summary" })).toBeInTheDocument();
    expect(latest).toHaveBeenCalledTimes(2);
  });

  it("uses the API service for Markdown download", async () => {
    vi.spyOn(reportApiClient, "getLatestReport").mockResolvedValue(createReport());
    const download = vi.spyOn(reportApiClient, "downloadMarkdown").mockResolvedValue(new Blob(["# Report"]));
    const createObjectUrl = vi.fn().mockReturnValue("blob:report");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const user = userEvent.setup();

    renderPage();
    await screen.findByRole("heading", { name: "daily-summary" });
    await user.click(screen.getByRole("button", { name: "Download Markdown" }));

    await waitFor(() => expect(download).toHaveBeenCalledWith("report-1"));
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:report");
  });
});

it("redirects the root route to the daily summary page", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "Daily summary" })).toBeInTheDocument();
});
