import type { ApiError, ApiResponse, NoDataResponse, Report, SuccessResponse } from "../types/api";

const DEFAULT_BACKEND_ORIGIN = "http://localhost:3000";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly details: ApiError,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ReportApiClient {
  getLatestReport(): Promise<Report | null>;
  generateReport(): Promise<SuccessResponse | NoDataResponse>;
  downloadMarkdown(reportId: string): Promise<Blob>;
}

function getBackendOrigin(): string {
  return (import.meta.env.VITE_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiError(value: unknown): value is ApiError {
  return (
    isRecord(value) &&
    value.status === "error" &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    typeof value.retryable === "boolean" &&
    typeof value.requestId === "string"
  );
}

function isApiResponse(value: unknown): value is ApiResponse {
  if (!isRecord(value) || typeof value.status !== "string") {
    return false;
  }

  if (isApiError(value)) {
    return true;
  }

  if (value.status === "no_data") {
    return typeof value.message === "string" && typeof value.requestId === "string";
  }

  return (value.status === "success" || value.status === "partial_success") && isRecord(value.report);
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json();
}

async function requestJson<T extends ApiResponse>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getBackendOrigin()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError("The backend service could not be reached", {
      status: "error",
      code: "BACKEND_UNAVAILABLE",
      message: "The backend service could not be reached",
      retryable: true,
      requestId: "",
    });
  }

  const payload = await parseResponse(response);
  if (!isApiResponse(payload)) {
    throw new ApiClientError("The backend returned an invalid response", {
      status: "error",
      code: "INVALID_API_RESPONSE",
      message: "The backend returned an invalid response",
      retryable: false,
      requestId: response.headers.get("x-request-id") || "",
    });
  }

  if (!response.ok || isApiError(payload)) {
    if (isApiError(payload)) {
      throw new ApiClientError(payload.message, payload);
    }
    throw new ApiClientError("The backend request failed", {
      status: "error",
      code: "HTTP_REQUEST_FAILED",
      message: "The backend request failed",
      retryable: response.status >= 500,
      requestId: response.headers.get("x-request-id") || "",
    });
  }

  return payload as T;
}

export const reportApiClient: ReportApiClient = {
  async getLatestReport(): Promise<Report | null> {
    try {
      const response = await requestJson<SuccessResponse>("/api/reports/latest");
      return response.report;
    } catch (error) {
      if (error instanceof ApiClientError && error.details.code === "REPORT_NOT_FOUND") {
        return null;
      }
      throw error;
    }
  },

  async generateReport(): Promise<SuccessResponse | NoDataResponse> {
    const response = await requestJson<ApiResponse>("/api/reports/generate", { method: "POST" });
    if (response.status === "no_data") {
      return response;
    }
    return response as SuccessResponse;
  },

  async downloadMarkdown(reportId: string): Promise<Blob> {
    let response: Response;
    try {
      response = await fetch(`${getBackendOrigin()}/api/reports/${encodeURIComponent(reportId)}/markdown`, {
        headers: { Accept: "text/markdown" },
      });
    } catch {
      throw new ApiClientError("The backend service could not be reached", {
        status: "error",
        code: "BACKEND_UNAVAILABLE",
        message: "The backend service could not be reached",
        retryable: true,
        requestId: "",
      });
    }

    if (!response.ok) {
      const payload = await parseResponse(response);
      if (isApiError(payload)) {
        throw new ApiClientError(payload.message, payload);
      }
      throw new ApiClientError("Markdown download failed", {
        status: "error",
        code: "MARKDOWN_DOWNLOAD_FAILED",
        message: "Markdown download failed",
        retryable: response.status >= 500,
        requestId: response.headers.get("x-request-id") || "",
      });
    }

    return response.blob();
  },
};
