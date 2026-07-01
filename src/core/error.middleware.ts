import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "./logger.js";
import { AppError, ValidationError } from "./errors.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const normalized = normalizeError(error, req.context?.requestId);

  if (normalized.statusCode >= 500) {
    logger.error(
      { err: error, requestId: req.context?.requestId },
      "Unhandled request error"
    );
  }

  res.status(normalized.statusCode).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details !== undefined
        ? { fields: normalized.details }
        : {}),
      request_id: req.context?.requestId
    }
  });
};

function normalizeError(error: unknown, requestId?: string): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new ValidationError(
      error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code,
        message: issue.message
      }))
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logPrismaError(error, requestId);
    if (error.code === "P2002") {
      return new AppError(409, "DUPLICATE_RESOURCE", "Resource already exists.");
    }
    if (error.code === "P2003") {
      return new AppError(
        409,
        "RESOURCE_IN_USE",
        "The record cannot be deleted because related records still exist."
      );
    }
    if (error.code === "P2025") {
      return new AppError(404, "NOT_FOUND", "Resource was not found.");
    }
  }
  return new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}

function logPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  requestId?: string
): void {
  if (process.env.NODE_ENV !== "development") return;
  logger.warn(
    {
      err: error,
      requestId,
      prismaCode: error.code,
      prismaMeta: error.meta
    },
    "Prisma request error"
  );
}
