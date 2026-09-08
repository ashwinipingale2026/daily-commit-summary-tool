import type { NextFunction, Request, Response } from "express";

export function corsMiddleware(allowedOrigin: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.header("Origin");

    if (origin && origin !== allowedOrigin) {
      response.status(403).json({
        status: "error",
        code: "CORS_ORIGIN_DENIED",
        message: "The request origin is not allowed",
        retryable: false,
        requestId: request.requestId,
      });
      return;
    }

    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Request-Id");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    next();
  };
}
