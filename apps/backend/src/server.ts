import app from "./app";
import { loadConfig } from "./config/environment";

const config = loadConfig();

app.listen(config.port, () => {
  console.log(`Daily Commit Summary backend listening on port ${config.port}`);
});