import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./core/config.js";
import { logger } from "./core/logger.js";
import { authRouter } from "./modules/auth/index.js";
import { adminRouter } from "./modules/admin/index.js";
import { performanceRouter } from "./modules/performance/index.js";
import { AppError } from "./core/errors.js";
import { errorHandler } from "./core/error.middleware.js";
import { requestContextMiddleware } from "./core/request-context.middleware.js";

export function createApp(): Application {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, "CORS_DENIED", "Origin is not allowed."));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.use(pinoHttp({ logger }));

  app.get("/health/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/performance", performanceRouter);

  app.use((_req, _res, next) => {
    next(new AppError(404, "ROUTE_NOT_FOUND", "Route was not found."));
  });
  app.use(errorHandler);
  return app;
}
