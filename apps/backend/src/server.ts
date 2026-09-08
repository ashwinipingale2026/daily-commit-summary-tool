import { Pool } from "pg";
import { createApp } from "./app";
import { loadConfig } from "./config/environment";
import { ReportRepository } from "./database/report-repository";

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const repository = new ReportRepository(pool);
const app = createApp({ config, repository });

app.listen(config.port, () => {
  console.log(`Daily Commit Summary backend listening on port ${config.port}`);
});