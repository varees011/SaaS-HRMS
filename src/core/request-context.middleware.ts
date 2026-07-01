import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = parseUuidHeader(req.header("x-request-id")) ?? randomUUID();
  const correlationId =
    parseUuidHeader(req.header("x-correlation-id")) ?? requestId;

  req.context = {
    requestId,
    correlationId,
    ...(req.ip ? { ipAddress: req.ip } : {}),
    ...(req.header("user-agent")
      ? { userAgent: req.header("user-agent")! }
      : {})
  };

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);
  next();
}

function parseUuidHeader(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : undefined;
}
