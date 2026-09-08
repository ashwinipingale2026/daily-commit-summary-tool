import type { NextFunction, Request, Response } from "express";
import type { ApiError } from "../types/api";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function sendError(response: Response, requestId: string, error: unknown): void {
  const httpError = toHttpError(error);
  const body: ApiError = {
    status: "error",
    code: httpError.code,
    message: httpError.message,
    retryable: httpError.retryable,
    requestId,
  };
  response.status(httpError.statusCode).json(body);
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (isBodyParserError(error)) {
    return new HttpError(400, "INVALID_JSON", "Request body must be valid JSON", false);
  }

  return new HttpError(500, "INTERNAL_ERROR", "An unexpected server error occurred", false);
}

function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "status" in error &&
    (error as { type: unknown }).type === "entity.parse.failed" &&
    (error as { status: unknown }).status === 400
  );
}

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  sendError(response, request.requestId, error);
}
