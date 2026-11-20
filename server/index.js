import { loadConfig } from "./config.js";
import { createTokenVerifier } from "./auth.js";
import { createPool } from "./db.js";
import { createApiServer } from "./app.js";

const config = loadConfig();
const pool = createPool(config);
const server = createApiServer({
  config,
  pool,
  verifyAccessToken: createTokenVerifier(config)
});

server.listen(config.port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ event: "api_started", port: config.port, environment: config.nodeEnv }) + "\n");
});

async function shutdown(signal) {
  process.stdout.write(JSON.stringify({ event: "api_shutdown", signal }) + "\n");
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
