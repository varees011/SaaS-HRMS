import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../../config/logger.js";
import { AppError, ValidationError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const normalized = normalizeError(error);

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

function normalizeError(error: unknown): AppError {
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
    if (error.code === "P2002") {
      return new AppError(409, "DUPLICATE_RESOURCE", "Resource already exists.");
    }
    if (error.code === "P2025") {
      return new AppError(404, "NOT_FOUND", "Resource was not found.");
    }
  }
  return new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}
