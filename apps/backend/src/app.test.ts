import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import type { AppConfig } from "./config/environment";

const config: AppConfig = {
  repositoryPath: "C:\\repositories\\daily-summary",
  databaseUrl: "postgresql://localhost/daily_summary",
  port: 3000,
  frontendOrigin: "http://localhost:5173",
  reportTimezone: "UTC",
  diffSizeLimit: 100_000,
};

function startServer() {
  const server = createApp({ config }).listen(0);
  const address = server.address() as AddressInfo;
  return {
    server,
    request(path: string, method = "GET", headers: Record<string, string> = {}) {
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
          clientRequest.end();
        },
      );
    },
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
