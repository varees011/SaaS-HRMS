import type { NextFunction, Request, Response } from "express";
import { RateLimitError } from "../../shared/errors/app-error.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export function authRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const now = Date.now();
  const key = req.ip || "unknown";
  const current = buckets.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, MAX_REQUESTS - bucket.count);
  res.setHeader("x-ratelimit-limit", MAX_REQUESTS);
  res.setHeader("x-ratelimit-remaining", remaining);
  res.setHeader("x-ratelimit-reset", Math.ceil(bucket.resetAt / 1000));

  if (bucket.count > MAX_REQUESTS) {
    next(new RateLimitError(Math.ceil((bucket.resetAt - now) / 1000)));
    return;
  }
  next();
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, WINDOW_MS);
cleanupTimer.unref();
