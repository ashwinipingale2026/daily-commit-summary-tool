import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConfigurationError, loadConfig } from "./environment";

function validEnvironment(repositoryPath: string): Record<string, string> {
  return {
    REPOSITORY_PATH: repositoryPath,
    DATABASE_URL: "postgresql://user:password@localhost:5432/daily_commit_summary",
    PORT: "3000",
    FRONTEND_ORIGIN: "http://localhost:5173",
    REPORT_TIMEZONE: "UTC",
    DIFF_SIZE_LIMIT: "100000",
  };
}

test("loads valid configuration with AI disabled by default", () => {
  const repositoryPath = mkdtempSync(join(tmpdir(), "daily-summary-config-"));

  try {
    const config = loadConfig(validEnvironment(repositoryPath));

    assert.equal(config.repositoryPath, repositoryPath);
    assert.equal(config.databaseUrl, "postgresql://user:password@localhost:5432/daily_commit_summary");
    assert.equal(config.port, 3000);
    assert.equal(config.frontendOrigin, "http://localhost:5173");
    assert.equal(config.reportTimezone, "UTC");
    assert.equal(config.diffSizeLimit, 100000);
    assert.equal(config.ai, undefined);
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("rejects missing required values without exposing their values", () => {
  assert.throws(
    () => loadConfig({ DATABASE_URL: "postgresql://secret-user:secret-password@localhost/db" }),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.message === "REPOSITORY_PATH is required" &&
      !error.message.includes("secret"),
  );
});

test("requires complete AI configuration", () => {
  const repositoryPath = mkdtempSync(join(tmpdir(), "daily-summary-config-"));

  try {
    assert.throws(
      () => loadConfig({ ...validEnvironment(repositoryPath), GITHUB_TOKEN: "secret-token" }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message ===
          "GITHUB_TOKEN, GITHUB_MODELS_ENDPOINT, and GITHUB_MODELS_MODEL are required when AI is configured" &&
        !error.message.includes("secret-token"),
    );
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("rejects a non-UTC reporting timezone", () => {
  const repositoryPath = mkdtempSync(join(tmpdir(), "daily-summary-config-"));

  try {
    assert.throws(
      () => loadConfig({ ...validEnvironment(repositoryPath), REPORT_TIMEZONE: "America/New_York" }),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message === "REPORT_TIMEZONE must be UTC for the MVP",
    );
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("applies defaults and accepts a complete optional AI configuration", () => {
  const repositoryPath = mkdtempSync(join(tmpdir(), "daily-summary-config-"));

  try {
    const config = loadConfig({
      ...validEnvironment(repositoryPath),
      PORT: undefined,
      FRONTEND_ORIGIN: undefined,
      DIFF_SIZE_LIMIT: undefined,
      GITHUB_TOKEN: "secret-token",
      GITHUB_MODELS_ENDPOINT: "https://models.example.test/chat",
      GITHUB_MODELS_MODEL: "gpt-4o-mini",
    });

    assert.equal(config.port, 3000);
    assert.equal(config.frontendOrigin, "http://localhost:5173");
    assert.equal(config.diffSizeLimit, 100000);
    assert.deepEqual(config.ai, {
      token: "secret-token",
      endpoint: "https://models.example.test/chat",
      model: "gpt-4o-mini",
    });
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("rejects invalid numeric and provider configuration", () => {
  const repositoryPath = mkdtempSync(join(tmpdir(), "daily-summary-config-"));

  try {
    assert.throws(
      () => loadConfig({ ...validEnvironment(repositoryPath), PORT: "70000" }),
      (error: unknown) => error instanceof ConfigurationError && error.message === "PORT must be an integer between 1 and 65535",
    );
    assert.throws(
      () => loadConfig({
        ...validEnvironment(repositoryPath),
        GITHUB_TOKEN: "secret-token",
        GITHUB_MODELS_ENDPOINT: "file:///tmp/models",
        GITHUB_MODELS_MODEL: "model",
      }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message === "GITHUB_MODELS_ENDPOINT must be a valid HTTP or HTTPS URL" &&
        !error.message.includes("secret-token"),
    );
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});
