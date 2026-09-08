import express, { type Express } from "express";
import type { AppConfig } from "./config/environment";
import { errorHandler } from "./api/errors";
import { corsMiddleware } from "./middleware/cors";
import { requestIdMiddleware } from "./middleware/request-id";
import { createHealthRouter } from "./routes/health";
import { createReportsRouter } from "./routes/reports";
import type { ReportGenerationPort, ReportMarkdownPort, ReportRepositoryPort } from "./types/api";

export interface AppOptions {
  config: AppConfig;
  repository?: ReportRepositoryPort;
  generation?: ReportGenerationPort;
  markdown?: ReportMarkdownPort;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(requestIdMiddleware);
  app.use(corsMiddleware(options.config.frontendOrigin));
  app.use("/health", createHealthRouter());
  app.use("/api/reports", createReportsRouter(options));
  app.use((request, response) => {
    response.status(404).json({
      status: "error",
      code: "NOT_FOUND",
      message: "The requested endpoint was not found",
      retryable: false,
      requestId: request.requestId,
    });
  });
  app.use(errorHandler);
  return app;
}

export default createApp;
