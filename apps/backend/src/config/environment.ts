import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface AppConfig {
  repositoryPath: string;
  databaseUrl: string;
  port: number;
  frontendOrigin: string;
  reportTimezone: "UTC";
  diffSizeLimit: number;
  ai?: {
    token: string;
    endpoint: string;
    model: string;
  };
}

type Environment = Record<string, string | undefined>;

const DEFAULT_PORT = 3000;
const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";
const DEFAULT_REPORT_TIMEZONE = "UTC";
const DEFAULT_DIFF_SIZE_LIMIT = 100_000;

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function requireEnvironmentValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new ConfigurationError(`${name} is required`);
  }

  return value;
}

function parsePort(environment: Environment): number {
  const rawValue = environment.PORT?.trim() || String(DEFAULT_PORT);
  const port = Number(rawValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ConfigurationError("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function parseFrontendOrigin(environment: Environment): string {
  const origin = environment.FRONTEND_ORIGIN?.trim() || DEFAULT_FRONTEND_ORIGIN;

  try {
    const url = new URL(origin);

    if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
      throw new Error();
    }
  } catch {
    throw new ConfigurationError("FRONTEND_ORIGIN must be an HTTP or HTTPS origin");
  }

  return origin;
}

function parseRepositoryPath(environment: Environment): string {
  const repositoryPath = resolve(requireEnvironmentValue(environment, "REPOSITORY_PATH"));

  if (!existsSync(repositoryPath) || !statSync(repositoryPath).isDirectory()) {
    throw new ConfigurationError("REPOSITORY_PATH must point to an existing directory");
  }

  return repositoryPath;
}

function parseDatabaseUrl(environment: Environment): string {
  const databaseUrl = requireEnvironmentValue(environment, "DATABASE_URL");

  try {
    const url = new URL(databaseUrl);

    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error();
    }
  } catch {
    throw new ConfigurationError("DATABASE_URL must be a PostgreSQL connection URL");
  }

  return databaseUrl;
}

function parseReportTimezone(environment: Environment): "UTC" {
  const reportTimezone = environment.REPORT_TIMEZONE?.trim() || DEFAULT_REPORT_TIMEZONE;

  if (reportTimezone !== "UTC") {
    throw new ConfigurationError("REPORT_TIMEZONE must be UTC for the MVP");
  }

  return "UTC";
}

function parseDiffSizeLimit(environment: Environment): number {
  const rawValue = environment.DIFF_SIZE_LIMIT?.trim() || String(DEFAULT_DIFF_SIZE_LIMIT);
  const diffSizeLimit = Number(rawValue);

  if (!Number.isSafeInteger(diffSizeLimit) || diffSizeLimit < 1) {
    throw new ConfigurationError("DIFF_SIZE_LIMIT must be a positive integer");
  }

  return diffSizeLimit;
}

function parseAiConfig(environment: Environment): AppConfig["ai"] {
  const token = environment.GITHUB_TOKEN?.trim();
  const endpoint = environment.GITHUB_MODELS_ENDPOINT?.trim();
  const model = environment.GITHUB_MODELS_MODEL?.trim();
  const hasAiConfiguration = Boolean(token || endpoint || model);

  if (!hasAiConfiguration) {
    return undefined;
  }

  if (!token || !endpoint || !model) {
    throw new ConfigurationError(
      "GITHUB_TOKEN, GITHUB_MODELS_ENDPOINT, and GITHUB_MODELS_MODEL are required when AI is configured",
    );
  }

  let endpointUrl: URL;

  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new ConfigurationError("GITHUB_MODELS_ENDPOINT must be a valid HTTP or HTTPS URL");
  }

  if (!["http:", "https:"].includes(endpointUrl.protocol)) {
    throw new ConfigurationError("GITHUB_MODELS_ENDPOINT must be a valid HTTP or HTTPS URL");
  }

  return { token, endpoint, model };
}

export function loadConfig(environment: Environment = process.env): AppConfig {
  return {
    repositoryPath: parseRepositoryPath(environment),
    databaseUrl: parseDatabaseUrl(environment),
    port: parsePort(environment),
    frontendOrigin: parseFrontendOrigin(environment),
    reportTimezone: parseReportTimezone(environment),
    diffSizeLimit: parseDiffSizeLimit(environment),
    ai: parseAiConfig(environment),
  };
}

export { ConfigurationError };
