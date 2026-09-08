import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import { HttpError } from "./api/errors";
import type { AppConfig } from "./config/environment";
import type { ApiResponse, ReportGenerationPort, ReportMarkdownPort, ReportRepositoryPort } from "./types/api";
import type { PersistedReport } from "./types/report";

const config: AppConfig = {
  repositoryPath: "C:\\repositories\\daily-summary",
  databaseUrl: "postgresql://localhost/daily_summary",
  port: 3000,
  frontendOrigin: "http://localhost:5173",
  reportTimezone: "UTC",
  diffSizeLimit: 100_000,
};

function startServer(options: {
  generation?: ReportGenerationPort;
  repository?: ReportRepositoryPort;
  markdown?: ReportMarkdownPort;
} = {}) {
  const server = createApp({ config, ...options }).listen(0);
  const address = server.address() as AddressInfo;
  return {
    server,
    request(path: string, method = "GET", headers: Record<string, string> = {}, body?: string) {
      return new Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }>(
        (resolve, reject) => {
          const clientRequest = request(
            { hostname: "127.0.0.1", port: address.port, path, method, headers },
            (response) => {
              let body = "";
              response.setEncoding("utf8");
              response.on("data", (chunk: string) => {
                body += chunk;
              });
              response.on("end", () =>
                resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body }),
              );
            },
          );
          clientRequest.on("error", reject);
          if (body) {
            clientRequest.write(body);
          }
          clientRequest.end();
        },
      );
    },
  };
}

function persistedReport(overrides: Partial<PersistedReport> = {}): PersistedReport {
  return {
    id: "report-id",
    authorIds: ["author-id"],
    repositoryPath: config.repositoryPath,
    repositoryName: "daily-summary",
    branchName: "main",
    headCommitHash: "abcdef123456",
    windowStart: new Date("2026-09-08T00:00:00.000Z"),
    windowEnd: new Date("2026-09-09T00:00:00.000Z"),
    scoringConfig: { formulaVersion: "activity-score-v1" },
    generatedAt: new Date("2026-09-09T00:01:00.000Z"),
    totalCommits: 1,
    contributingAuthors: 1,
    outputPath: null,
    generationStatus: "completed",
    authors: [{
      authorName: "Ada Lovelace",
      authorEmail: "ada@example.com",
      commitCount: 1,
      filesTouched: 1,
      linesAdded: 2,
      linesRemoved: 1,
      activityScore: 3.3,
      activityLevel: "low",
      summaryText: "Updated the report.",
      summarySource: "fallback",
      summaryStatus: "available",
      summaryWarning: null,
      commits: [],
    }],
    warnings: [],
    ...overrides,
  };
}

test("health endpoint returns a safe response and request ID", async (t) => {
  const server = startServer();
  t.after(() => server.server.close());

  const response = await server.request("/health", "GET", { "X-Request-Id": "prototype-request" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { status: "ok" });
  assert.equal(response.headers["x-request-id"], "prototype-request");
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
});

test("report routes return stable unavailable errors until services are wired", async (t) => {
  const server = startServer();
  t.after(() => server.server.close());

  const generateResponse = await server.request("/api/reports/generate", "POST");
  assert.equal(generateResponse.statusCode, 503);
  assert.deepEqual(JSON.parse(generateResponse.body), {
    status: "error",
    code: "REPORT_GENERATION_UNAVAILABLE",
    message: "Report generation is not available",
    retryable: true,
    requestId: generateResponse.headers["x-request-id"],
  });

  const latestResponse = await server.request("/api/reports/latest");
  assert.equal(latestResponse.statusCode, 503);
  assert.equal(JSON.parse(latestResponse.body).code, "REPORT_REPOSITORY_UNAVAILABLE");

  const markdownResponse = await server.request("/api/reports/report-id/markdown");
  assert.equal(markdownResponse.statusCode, 503);
  assert.equal(JSON.parse(markdownResponse.body).code, "MARKDOWN_UNAVAILABLE");
});

test("generation endpoint returns no-data with its request ID", async (t) => {
  const generation: ReportGenerationPort = {
    async generate(): Promise<ApiResponse> {
      return { status: "no_data", message: "No commits in the last 24 hours - report not generated.", requestId: "" };
    },
  };
  const app = createApp({ config, generation });
  const server = app.listen(0);
  t.after(() => server.close());
  const address = server.address() as AddressInfo;

  const response = await new Promise<{ statusCode: number; body: string; requestId: string | string[] | undefined }>(
    (resolve, reject) => {
      const clientRequest = request(
        { hostname: "127.0.0.1", port: address.port, path: "/api/reports/generate", method: "POST", headers: { "X-Request-Id": "generate-request" } },
        (result) => {
          let body = "";
          result.setEncoding("utf8");
          result.on("data", (chunk: string) => { body += chunk; });
          result.on("end", () => resolve({ statusCode: result.statusCode ?? 0, body, requestId: result.headers["x-request-id"] }));
        },
      );
      clientRequest.on("error", reject);
      clientRequest.end();
    },
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    status: "no_data",
    message: "No commits in the last 24 hours - report not generated.",
    requestId: "generate-request",
  });
  assert.equal(response.requestId, "generate-request");
});

test("generation returns success and partial-success envelopes", async (t) => {
    const report = persistedReport();
    const generation: ReportGenerationPort = {
      async generate(): Promise<ApiResponse> {
        return {
          status: "partial_success",
          report: {
            id: report.id,
            repository: report.repositoryName,
            branch: report.branchName,
            window: { start: report.windowStart.toISOString(), end: report.windowEnd.toISOString() },
            generatedAt: report.generatedAt.toISOString(),
            totals: { commits: 1, authors: 1, filesTouched: 1, linesAdded: 2, linesRemoved: 1 },
            authors: [],
            warnings: [{ code: "MARKDOWN_WRITE_FAILED", message: "Markdown output could not be written" }],
          },
        };
      },
    };
    const server = startServer({ generation });
    t.after(() => server.server.close());

    const response = await server.request("/api/reports/generate", "POST", { "X-Request-Id": "partial-request" });
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, "partial_success");
    assert.equal(body.report.warnings[0].code, "MARKDOWN_WRITE_FAILED");
    assert.equal(response.headers["x-request-id"], "partial-request");
  });

test("maps generation dependency, validation, and unexpected failures", async (t) => {
    const cases: Array<{ error: unknown; status: number; code: string; retryable: boolean }> = [
      { error: new HttpError(422, "INVALID_REPOSITORY", "The configured repository is invalid", false), status: 422, code: "INVALID_REPOSITORY", retryable: false },
      { error: new HttpError(503, "AI_UNAVAILABLE", "AI summaries are unavailable", true), status: 503, code: "AI_UNAVAILABLE", retryable: true },
      { error: new Error("provider-token-secret"), status: 500, code: "INTERNAL_ERROR", retryable: false },
    ];

    for (const testCase of cases) {
      const generation: ReportGenerationPort = {
        async generate(): Promise<ApiResponse> {
          throw testCase.error;
        },
      };
      const server = startServer({ generation });
      const response = await server.request("/api/reports/generate", "POST");
      server.server.close();
      const body = JSON.parse(response.body);

      assert.equal(response.statusCode, testCase.status);
      assert.equal(body.code, testCase.code);
      assert.equal(body.retryable, testCase.retryable);
      assert.notEqual(body.message.includes("provider-token-secret"), true);
      assert.equal(body.requestId, response.headers["x-request-id"]);
    }
  });

test("maps malformed JSON to a 400 response envelope", async (t) => {
    const server = startServer();
    t.after(() => server.server.close());

    const response = await server.request(
      "/api/reports/generate",
      "POST",
      { "Content-Type": "application/json", "Content-Length": "9" },
      "{invalid}",
    );
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 400);
    assert.equal(body.code, "INVALID_JSON");
    assert.equal(body.retryable, false);
    assert.equal(body.requestId, response.headers["x-request-id"]);
  });

test("returns 409 for concurrent generation without changing report state", async (t) => {
    let release!: () => void;
    let running = false;
    const generation: ReportGenerationPort = {
      generate: () => {
        if (running) {
          return Promise.reject(new HttpError(409, "GENERATION_ALREADY_RUNNING", "A report generation is already in progress", true));
        }
        running = true;
        return new Promise<ApiResponse>((resolve) => {
          release = () => {
            running = false;
            resolve({ status: "no_data", message: "No commits in the last 24 hours - report not generated.", requestId: "" });
          };
        });
      },
    };
    const server = startServer({ generation });
    t.after(() => server.server.close());
    const first = server.request("/api/reports/generate", "POST");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await server.request("/api/reports/generate", "POST");
    release();
    const firstResponse = await first;

    assert.equal(second.statusCode, 409);
    assert.equal(JSON.parse(second.body).code, "GENERATION_ALREADY_RUNNING");
    assert.equal(firstResponse.statusCode, 200);
    assert.equal(JSON.parse(firstResponse.body).status, "no_data");
  });

test("serves the latest report and maps missing or unavailable repositories", async (t) => {
    const repository: ReportRepositoryPort = {
      async findLatestReport() { return persistedReport(); },
      async findReportById() { return null; },
    };
    const server = startServer({ repository });
    t.after(() => server.server.close());

    const success = await server.request("/api/reports/latest");
    assert.equal(success.statusCode, 200);
    assert.equal(JSON.parse(success.body).status, "success");
    assert.equal(JSON.parse(success.body).report.id, "report-id");

    server.server.close();
    const emptyServer = startServer({
      repository: { async findLatestReport() { return null; }, async findReportById() { return null; } },
    });
    t.after(() => emptyServer.server.close());
    const missing = await emptyServer.request("/api/reports/latest");
    assert.equal(missing.statusCode, 404);
    assert.equal(JSON.parse(missing.body).code, "REPORT_NOT_FOUND");
  });

test("downloads Markdown and maps missing or unavailable projections", async (t) => {
    const markdown: ReportMarkdownPort = { async render(reportId) { return reportId === "report-id" ? "# Daily summary\n" : null; } };
    const server = startServer({ markdown });
    t.after(() => server.server.close());

    const success = await server.request("/api/reports/report-id/markdown");
    assert.equal(success.statusCode, 200);
    assert.equal(success.headers["content-type"], "text/markdown; charset=utf-8");
    assert.match(String(success.headers["content-disposition"]), /commit-summary-report-id\.md/);
    assert.equal(success.body, "# Daily summary\n");

    const missing = await server.request("/api/reports/missing/markdown");
    assert.equal(missing.statusCode, 404);
    assert.equal(JSON.parse(missing.body).code, "REPORT_NOT_FOUND");
  });

test("denies origins other than the configured frontend", async (t) => {
  const server = startServer();
  t.after(() => server.server.close());

  const response = await server.request("/health", "GET", { Origin: "https://untrusted.example" });
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).code, "CORS_ORIGIN_DENIED");
});

test("unknown endpoints use the standard error envelope", async (t) => {
  const server = startServer();
  t.after(() => server.server.close());

  const response = await server.request("/unknown");
  assert.equal(response.statusCode, 404);
  const body = JSON.parse(response.body);
  assert.equal(body.status, "error");
  assert.equal(body.code, "NOT_FOUND");
  assert.equal(body.requestId, response.headers["x-request-id"]);
});
