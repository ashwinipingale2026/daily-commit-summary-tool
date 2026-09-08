import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction): void {
  const incomingRequestId = request.header("X-Request-Id")?.trim();
  const requestId = incomingRequestId || randomUUID();
  request.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  next();
}
