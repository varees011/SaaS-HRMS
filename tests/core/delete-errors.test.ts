import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { errorHandler } from "../../src/core/error.middleware.js";
import { AppError } from "../../src/core/errors.js";
import { validate } from "../../src/core/validate.middleware.js";

describe("delete route error handling", () => {
  it("returns 400 for invalid route ids before delete handlers run", () => {
    const middleware = validate({
      params: z.object({ id: z.string().uuid() })
    });
    const next = vi.fn() as unknown as NextFunction;

    middleware(
      { params: { id: "undefined" } } as unknown as Request,
      {} as Response,
      next
    );

    const error = vi.mocked(next).mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("INVALID_ROUTE_PARAMS");
  });

  it("maps Prisma foreign-key delete failures to 409", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint failed",
      {
        code: "P2003",
        clientVersion: "test",
        meta: { field_name: "foreign key" }
      }
    );
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    errorHandler(
      error,
      { context: { requestId: "request-1" } } as unknown as Request,
      { status, json } as unknown as Response,
      vi.fn()
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "RESOURCE_IN_USE",
        message:
          "The record cannot be deleted because related records still exist.",
        request_id: "request-1"
      }
    });
  });
});
