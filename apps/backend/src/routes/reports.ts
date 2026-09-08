import { Router } from "express";
import type { AppConfig } from "../config/environment";
import { HttpError } from "../api/errors";
import { reportProjection } from "../api/projection";
import type {
  ReportGenerationPort,
  ReportMarkdownPort,
  ReportRepositoryPort,
} from "../types/api";

interface ReportRouteOptions {
  config: AppConfig;
  repository?: ReportRepositoryPort;
  generation?: ReportGenerationPort;
  markdown?: ReportMarkdownPort;
}

export function createReportsRouter(options: ReportRouteOptions): Router {
  const router = Router();

  router.post("/generate", async (request, response, next) => {
    try {
      if (!options.generation) {
        throw new HttpError(503, "REPORT_GENERATION_UNAVAILABLE", "Report generation is not available", true);
      }
      const result = await options.generation.generate();
      response.status(result.status === "error" ? 500 : 200).json(
        result.status === "error" ? { ...result, requestId: request.requestId } : result,
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/latest", async (request, response, next) => {
    try {
      if (!options.repository) {
        throw new HttpError(503, "REPORT_REPOSITORY_UNAVAILABLE", "Report retrieval is not available", true);
      }
      const report = await options.repository.findLatestReport(options.config.repositoryPath);
      if (!report) {
        response.status(404).json({
          status: "error",
          code: "REPORT_NOT_FOUND",
          message: "No generated report is available",
          retryable: false,
          requestId: request.requestId,
        });
        return;
      }
      const projection = reportProjection.toProjection(report);
      response.json({ status: report.generationStatus === "partial_success" ? "partial_success" : "success", report: projection });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/markdown", async (request, response, next) => {
    try {
      if (!options.markdown) {
        throw new HttpError(503, "MARKDOWN_UNAVAILABLE", "Markdown download is not available", true);
      }
      const markdown = await options.markdown.render(request.params.id);
      if (markdown === null) {
        response.status(404).json({
          status: "error",
          code: "REPORT_NOT_FOUND",
          message: "The requested report was not found",
          retryable: false,
          requestId: request.requestId,
        });
        return;
      }
      response.type("text/markdown").attachment(`commit-summary-${request.params.id}.md`).send(markdown);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
