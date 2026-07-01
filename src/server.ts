import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./core/config.js";
import { logger } from "./core/logger.js";
import { prisma } from "./core/db.js";

const server = createServer(createApp());

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "HRMS API listening");
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
