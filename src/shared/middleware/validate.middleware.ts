import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ValidationError } from "../errors/app-error.js";

interface RequestSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: Array<{ field: string; code: string; message: string }> = [];

    for (const [location, schema] of Object.entries(schemas)) {
      if (!schema) continue;
      const result = schema.safeParse(req[location as keyof Request]);
      if (result.success) {
        if (location === "body") {
          req.body = result.data;
        } else if (location === "params") {
          Object.assign(req.params, result.data);
        } else if (location === "query") {
          Object.assign(req.query, result.data);
        }
      } else {
        for (const issue of result.error.issues) {
          issues.push({
            field: [location, ...issue.path].join("."),
            code: issue.code,
            message: issue.message
          });
        }
      }
    }

    if (issues.length > 0) {
      next(new ValidationError(issues));
      return;
    }
    next();
  };
}
