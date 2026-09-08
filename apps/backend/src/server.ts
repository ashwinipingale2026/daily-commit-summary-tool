import { Pool } from "pg";
import { createApp } from "./app";
import { loadConfig } from "./config/environment";
import { ReportRepository } from "./database/report-repository";
import { reportProjection } from "./api/projection";
import { ReportGenerationService } from "./services/reports/report-generation";
import { MarkdownRenderer } from "./services/reports/markdown-renderer";

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const repository = new ReportRepository(pool);
const markdown = new MarkdownRenderer(repository);
const generation = new ReportGenerationService({
  config,
  persistence: repository,
  projection: reportProjection,
  markdown,
});
const app = createApp({ config, repository, generation, markdown });
const server = app.listen(config.port, () => {
  console.log(`Daily Commit Summary backend listening on port ${config.port}`);
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully`);

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await pool.end();
    console.log("Daily Commit Summary backend stopped");
  } catch (error) {
    console.error("Failed to shut down the backend cleanly", error);
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});